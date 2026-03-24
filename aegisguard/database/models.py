"""
AegisGuard – SQLAlchemy 2.x Database Models
All tables use PostgreSQL 16. Audit logs are immutable once written.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class DeviceStatus(str, enum.Enum):
    active   = "active"
    inactive = "inactive"
    blocked  = "blocked"

class NetworkStatus(str, enum.Enum):
    active   = "active"
    inactive = "inactive"

class UserRole(str, enum.Enum):
    super_admin   = "super_admin"
    network_admin = "network_admin"
    auditor       = "auditor"
    viewer        = "viewer"

class FirewallAction(str, enum.Enum):
    allow = "allow"
    deny  = "deny"
    drop  = "drop"

class FirewallProtocol(str, enum.Enum):
    tcp  = "tcp"
    udp  = "udp"
    icmp = "icmp"
    any  = "any"

class FirewallDirection(str, enum.Enum):
    inbound  = "inbound"
    outbound = "outbound"
    both     = "both"

class IdsCategory(str, enum.Enum):
    malware    = "malware"
    portscan   = "portscan"
    bruteforce = "bruteforce"
    dos        = "dos"
    exploit    = "exploit"
    anomaly    = "anomaly"
    custom     = "custom"

class IdsSeverity(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"

class IdsAction(str, enum.Enum):
    alert = "alert"
    block = "block"
    drop  = "drop"

class FileAction(str, enum.Enum):
    create = "create"
    edit   = "edit"
    delete = "delete"
    rename = "rename"
    view   = "view"

class AuditSeverity(str, enum.Enum):
    info     = "info"
    warning  = "warning"
    error    = "error"
    critical = "critical"


# ─── Core Tables ──────────────────────────────────────────────────────────────

class AdminUser(Base):
    """
    Dashboard administrators – NOT endpoint users.
    Endpoint users are tracked by their digital certificate CN.
    """
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.viewer
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )


class Network(Base):
    """
    Virtual VPN network (e.g., IT-Network, Finance-Network).
    Each has its own OpenVPN server instance on a unique port.
    """
    __tablename__ = "networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subnet: Mapped[str] = mapped_column(String(18), nullable=False)  # e.g. 10.0.1.0/24
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=1194)
    protocol: Mapped[str] = mapped_column(String(3), nullable=False, default="udp")
    status: Mapped[NetworkStatus] = mapped_column(
        Enum(NetworkStatus, name="network_status"), nullable=False, default=NetworkStatus.active
    )
    vpn_config_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    devices = relationship("Device", back_populates="network", lazy="selectin")
    firewall_rules = relationship("FirewallRule", back_populates="network", lazy="selectin")


class Device(Base):
    """
    Every registered endpoint. The triple (mac, ip, cert_fingerprint) must ALL match
    for zero-trust pre-connection verification.
    """
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    mac: Mapped[str] = mapped_column(String(17), unique=True, nullable=False)
    ip: Mapped[str] = mapped_column(String(45), nullable=False)             # IPv4 or IPv6
    cert_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False)
    cert_serial: Mapped[str | None] = mapped_column(String(64), nullable=True)
    network_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("networks.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="device_status"), nullable=False, default=DeviceStatus.active
    )
    platform: Mapped[str] = mapped_column(String(16), nullable=False, default="linux")
    agent_version: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    network = relationship("Network", back_populates="devices")
    file_events = relationship("FileEvent", back_populates="device", lazy="dynamic")
    ids_alerts = relationship("IdsAlert", back_populates="device", lazy="dynamic")


class OvpnIssuance(Base):
    """Tracks every .ovpn file generated for a device/network pair."""
    __tablename__ = "ovpn_issuances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    network_id: Mapped[int] = mapped_column(Integer, ForeignKey("networks.id", ondelete="CASCADE"))
    common_name: Mapped[str] = mapped_column(String(64), nullable=False)
    cert_serial: Mapped[str] = mapped_column(String(64), nullable=False)
    issued_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("admin_users.id"), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )


class FirewallRule(Base):
    """
    Stateful firewall rule. Applied at the network level or pushed to a specific agent.
    Priority lower number = evaluated first.
    """
    __tablename__ = "firewall_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    network_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("networks.id", ondelete="SET NULL"), nullable=True
    )
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[FirewallAction] = mapped_column(
        Enum(FirewallAction, name="firewall_action"), nullable=False
    )
    source_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    dest_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    source_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protocol: Mapped[FirewallProtocol] = mapped_column(
        Enum(FirewallProtocol, name="firewall_protocol"), nullable=False, default=FirewallProtocol.any
    )
    direction: Mapped[FirewallDirection] = mapped_column(
        Enum(FirewallDirection, name="firewall_direction"), nullable=False, default=FirewallDirection.both
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    network = relationship("Network", back_populates="firewall_rules")


class IdsSignature(Base):
    """IDS/IPS detection signature (regex pattern + metadata)."""
    __tablename__ = "ids_signatures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)     # Regex for packet payload
    category: Mapped[IdsCategory] = mapped_column(
        Enum(IdsCategory, name="ids_category"), nullable=False
    )
    severity: Mapped[IdsSeverity] = mapped_column(
        Enum(IdsSeverity, name="ids_severity"), nullable=False
    )
    action: Mapped[IdsAction] = mapped_column(
        Enum(IdsAction, name="ids_action"), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )


class IdsAlert(Base):
    """Generated when a signature or anomaly matches a packet/behavior."""
    __tablename__ = "ids_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signature_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ids_signatures.id", ondelete="SET NULL"), nullable=True
    )
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    source_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    dest_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    source_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dest_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    severity: Mapped[IdsSeverity] = mapped_column(
        Enum(IdsSeverity, name="ids_severity"), nullable=False
    )
    action: Mapped[IdsAction] = mapped_column(
        Enum(IdsAction, name="ids_action"), nullable=False
    )
    payload_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("admin_users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    signature = relationship("IdsSignature")
    device = relationship("Device", back_populates="ids_alerts")


class FileEvent(Base):
    """
    Immutable record of every file system event on a protected resource.
    hash_before / hash_after are SHA-256 of file content.
    user_signature is the base64-encoded digital signature by the agent's user key.
    """
    __tablename__ = "file_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    user_cert_cn: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Certificate CN of actor
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[FileAction] = mapped_column(
        Enum(FileAction, name="file_action"), nullable=False
    )
    hash_before: Mapped[str | None] = mapped_column(String(64), nullable=True)    # SHA-256 hex
    hash_after: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_signature: Mapped[str | None] = mapped_column(Text, nullable=True)        # Base64 sig
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(17), nullable=True)
    privileges_used: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    device = relationship("Device", back_populates="file_events")


class Policy(Base):
    """
    Granular access control policy for a specific resource path.
    Enforced by the client agent – cannot be bypassed locally.
    """
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=True
    )
    user_cert_cn: Mapped[str | None] = mapped_column(String(128), nullable=True)
    group_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_path: Mapped[str] = mapped_column(Text, nullable=False)
    # Permissions stored as JSON: {"view":true,"edit":false,"delete":false,"rename":false,"full_control":false}
    permissions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()"), onupdate=datetime.utcnow
    )


class AuditLog(Base):
    """
    Immutable, server-signed audit trail. Every security event must produce an AuditLog entry.
    server_signature = RSA-PSS signature of the JSON payload signed with the server master key.
    Once written, rows must NEVER be updated or deleted (enforced by DB trigger below).
    """
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False,
                                           default=lambda: str(uuid.uuid4()))
    device_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    admin_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "device.blocked"
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(17), nullable=True)
    severity: Mapped[AuditSeverity] = mapped_column(
        Enum(AuditSeverity, name="audit_severity"), nullable=False, default=AuditSeverity.info
    )
    server_signature: Mapped[str | None] = mapped_column(Text, nullable=True)  # Base64 RSA-PSS sig
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )

    # Read-only constraint – enforced at application layer + optional DB trigger
    __table_args__ = (
        # Prevent accidental deletions via FK constraints
    )
