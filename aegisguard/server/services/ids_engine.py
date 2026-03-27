"""
AegisGuard – IDS/IPS Packet Inspection Engine
Uses Scapy for packet capture + netfilterqueue (Linux) for inline prevention (IPS mode).

Runs as a separate process (aegisguard-ids systemd service / Windows service).
Communicates results to the main server via Redis pub/sub.

Threat model:
  - Signature-based: regex patterns matched against packet payloads
  - Anomaly-based: statistical deviation from per-device traffic baseline
  - IPS mode: drop/block packets inline via NFQUEUE (Linux) or WinDivert (Windows)
"""
from __future__ import annotations

import asyncio
import json
import os
import platform
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import redis
from loguru import logger

# Conditional Scapy import (won't crash on import in non-packet environments)
try:
    from scapy.all import sniff, IP, TCP, UDP, Raw  # type: ignore
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    logger.warning("Scapy not available – packet inspection disabled")

try:
    import netfilterqueue  # type: ignore
    NFQ_AVAILABLE = True
except ImportError:
    NFQ_AVAILABLE = False

REDIS_URL  = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
IDS_CHANNEL = "aegisguard:ids:alerts"

# ─── Signature Database ───────────────────────────────────────────────────────

BUILTIN_SIGNATURES: list[dict] = [
    {"id": 1,  "name": "SSH Brute Force",       "pattern": r"Failed password.*sshd",               "category": "bruteforce", "severity": "high",     "action": "block"},
    {"id": 2,  "name": "SQL Injection",          "pattern": r"(?i)(union|select|insert|drop).*(from|into|table)", "category": "exploit",   "severity": "critical", "action": "drop"},
    {"id": 3,  "name": "Port Scan (Nmap)",       "pattern": r"Nmap scan|masscan|nmap",              "category": "portscan",   "severity": "medium",   "action": "alert"},
    {"id": 4,  "name": "Malware C2 Beacon",      "pattern": r"POST.*\.php.*cmd=",                  "category": "malware",    "severity": "critical", "action": "drop"},
    {"id": 5,  "name": "DoS SYN Flood",          "pattern": r"SYN_FLOOD|TCP SYN flood",            "category": "dos",        "severity": "high",     "action": "block"},
    {"id": 6,  "name": "FTP Brute Force",        "pattern": r"Login incorrect.*ftp",               "category": "bruteforce", "severity": "medium",   "action": "block"},
    {"id": 7,  "name": "XSS Attempt",            "pattern": r"<script.*?>.*?</script>",            "category": "exploit",    "severity": "high",     "action": "drop"},
    {"id": 8,  "name": "Directory Traversal",    "pattern": r"\.\./\.\./|%2e%2e%2f",              "category": "exploit",    "severity": "high",     "action": "drop"},
    {"id": 9,  "name": "Shell Command Injection", "pattern": r";\s*(ls|cat|rm|wget|curl|bash|sh)\s", "category": "exploit", "severity": "critical", "action": "drop"},
    {"id": 10, "name": "Heartbleed",             "pattern": r"\x18\x03[\x00-\x03]",               "category": "exploit",    "severity": "critical", "action": "drop"},
    {"id": 11, "name": "Log4Shell",              "pattern": r"\$\{jndi:",                          "category": "exploit",    "severity": "critical", "action": "drop"},
    {"id": 12, "name": "WannaCry SMB",           "pattern": r"ETERNALBLUE|DoublePulsar",           "category": "malware",    "severity": "critical", "action": "drop"},
]


@dataclass
class TrafficBaseline:
    """Per-source-IP traffic baseline for anomaly detection."""
    packet_count: int = 0
    byte_count: int   = 0
    port_set: set     = field(default_factory=set)
    start_time: float = field(default_factory=time.time)

    def packets_per_sec(self) -> float:
        elapsed = max(time.time() - self.start_time, 0.001)
        return self.packet_count / elapsed

    def is_anomalous(self) -> bool:
        """Basic anomaly: >1000 packets/sec OR >50 unique ports (port scan)."""
        return self.packets_per_sec() > 1000 or len(self.port_set) > 50


class IdsEngine:
    """
    The core IDS/IPS engine. Runs in its own event loop.

    Modes:
      - IDS (passive): sniff packets, generate alerts, publish to Redis
      - IPS (inline):  intercept via NFQUEUE, drop/block malicious packets
    """

    def __init__(self):
        self.redis      = redis.from_url(REDIS_URL, decode_responses=True)
        self.signatures = self._compile_signatures()
        self.baselines: dict[str, TrafficBaseline] = defaultdict(TrafficBaseline)
        self.running    = False

    def _compile_signatures(self) -> list[dict]:
        """Pre-compile all regex patterns for efficiency."""
        compiled = []
        for sig in BUILTIN_SIGNATURES:
            try:
                compiled.append({**sig, "_regex": re.compile(sig["pattern"], re.IGNORECASE | re.DOTALL)})
            except re.error as e:
                logger.warning(f"Invalid signature pattern '{sig['name']}': {e}")
        return compiled

    def reload_signatures(self, custom_sigs: list[dict]) -> None:
        """Add custom signatures from the database at runtime."""
        for sig in custom_sigs:
            try:
                self.signatures.append({**sig, "_regex": re.compile(sig["pattern"], re.IGNORECASE | re.DOTALL)})
            except re.error:
                pass

    def _inspect_payload(self, payload: str, src_ip: str, dst_ip: str,
                          src_port: int, dst_port: int) -> list[dict]:
        """Match packet payload against all signatures. Returns list of triggered sigs."""
        triggered = []
        for sig in self.signatures:
            if sig["_regex"].search(payload):
                triggered.append({
                    "signature_id": sig["id"],
                    "signature_name": sig["name"],
                    "category": sig["category"],
                    "severity": sig["severity"],
                    "action": sig["action"],
                    "source_ip": src_ip,
                    "dest_ip": dst_ip,
                    "source_port": src_port,
                    "dest_port": dst_port,
                    "payload_excerpt": payload[:256],
                    "timestamp": time.time(),
                })
        return triggered

    def _publish_alert(self, alert: dict) -> None:
        """Publish alert to Redis channel for the main server to persist."""
        try:
            self.redis.publish(IDS_CHANNEL, json.dumps(alert))
        except Exception as e:
            logger.error(f"Failed to publish IDS alert: {e}")

    def _handle_packet_ids(self, pkt: Any) -> None:
        """IDS mode: passive packet inspection (no blocking)."""
        if not pkt.haslayer(IP):
            return

        src_ip  = pkt[IP].src
        dst_ip  = pkt[IP].dst
        src_port = pkt[TCP].sport if pkt.haslayer(TCP) else (pkt[UDP].sport if pkt.haslayer(UDP) else 0)
        dst_port = pkt[TCP].dport if pkt.haslayer(TCP) else (pkt[UDP].dport if pkt.haslayer(UDP) else 0)

        # Update traffic baseline
        baseline = self.baselines[src_ip]
        baseline.packet_count += 1
        baseline.byte_count   += len(pkt)
        if dst_port:
            baseline.port_set.add(dst_port)

        # Anomaly detection
        if baseline.is_anomalous():
            self._publish_alert({
                "signature_id": None,
                "signature_name": "Anomaly: Traffic Baseline Exceeded",
                "category": "anomaly",
                "severity": "high",
                "action": "alert",
                "source_ip": src_ip,
                "dest_ip": dst_ip,
                "source_port": src_port,
                "dest_port": dst_port,
                "payload_excerpt": f"pps={baseline.packets_per_sec():.1f}, unique_ports={len(baseline.port_set)}",
                "timestamp": time.time(),
            })
            self.baselines[src_ip] = TrafficBaseline()  # Reset baseline

        # Signature matching on payload
        if pkt.haslayer(Raw):
            try:
                payload = pkt[Raw].load.decode("utf-8", errors="replace")
            except Exception:
                return
            for alert in self._inspect_payload(payload, src_ip, dst_ip, src_port, dst_port):
                logger.warning(f"IDS ALERT [{alert['severity'].upper()}] {alert['signature_name']} "
                               f"from {src_ip}:{src_port} → {dst_ip}:{dst_port}")
                self._publish_alert(alert)

    def _handle_packet_ips(self, nfq_packet: Any) -> None:
        """IPS mode: inline packet decision via NFQUEUE. Drops malicious packets."""
        from scapy.all import IP as ScapyIP
        pkt_data = nfq_packet.get_payload()

        try:
            pkt = ScapyIP(pkt_data)
        except Exception:
            nfq_packet.accept()
            return

        src_ip   = pkt.src
        dst_ip   = pkt.dst
        src_port = pkt[TCP].sport if pkt.haslayer(TCP) else 0
        dst_port = pkt[TCP].dport if pkt.haslayer(TCP) else 0

        if pkt.haslayer(Raw):
            try:
                payload = pkt[Raw].load.decode("utf-8", errors="replace")
            except Exception:
                nfq_packet.accept()
                return

            alerts = self._inspect_payload(payload, src_ip, dst_ip, src_port, dst_port)
            for alert in alerts:
                self._publish_alert(alert)
                if alert["action"] in ("drop", "block"):
                    logger.warning(f"IPS DROP [{alert['severity'].upper()}] {alert['signature_name']} "
                                   f"{src_ip} → {dst_ip}:{dst_port}")
                    nfq_packet.drop()
                    return

        nfq_packet.accept()

    def run_ids_mode(self, interface: str = "any") -> None:
        """Start passive IDS sniffing (does not require NFQUEUE/root privilege for reading)."""
        if not SCAPY_AVAILABLE:
            logger.error("Scapy not available. IDS disabled.")
            return
        self.running = True
        logger.info(f"IDS engine started in passive mode on interface '{interface}'")
        sniff(iface=None if interface == "any" else interface,
              prn=self._handle_packet_ids,
              store=False,
              stop_filter=lambda _: not self.running)

    def run_ips_mode(self, queue_num: int = 0) -> None:
        """
        Start inline IPS mode via NFQUEUE.
        Requires: iptables -A FORWARD -j NFQUEUE --queue-num 0
        Must run as root or with CAP_NET_ADMIN.
        """
        if not NFQ_AVAILABLE:
            logger.error("netfilterqueue not available. Falling back to IDS mode.")
            self.run_ids_mode()
            return

        nfqueue = netfilterqueue.NetfilterQueue()
        nfqueue.bind(queue_num, self._handle_packet_ips)
        self.running = True
        logger.info(f"IPS engine started in inline mode (NFQUEUE {queue_num})")
        try:
            nfqueue.run()
        except KeyboardInterrupt:
            pass
        finally:
            nfqueue.unbind()


def main():
    """Entry point for the IDS/IPS service."""
    import argparse
    parser = argparse.ArgumentParser(description="AegisGuard IDS/IPS Engine")
    parser.add_argument("--mode", choices=["ids", "ips"], default="ids")
    parser.add_argument("--interface", default="any")
    parser.add_argument("--queue", type=int, default=0)
    args = parser.parse_args()

    engine = IdsEngine()
    if args.mode == "ips":
        engine.run_ips_mode(args.queue)
    else:
        engine.run_ids_mode(args.interface)


if __name__ == "__main__":
    main()
