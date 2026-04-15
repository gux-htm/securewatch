content = r'''import { useState, useEffect, useRef } from "react";
import { Shield, Wifi, Download, CheckCircle, Clock, AlertTriangle, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "form" | "pending" | "approved" | "vpn_ready";
interface Network { id: number; name: string; }
interface Fingerprint { ip: string; hostname: string; user_agent: string; }
interface DeviceStatus {
  device_id: number; mac: string; ip: string; hostname: string;
  status: string; approved: boolean; signature: string | null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

/** HTTP-safe clipboard copy — falls back to textarea trick when Clipboard API unavailable */
function safeCopy(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    resolve();
  });
}

function Row({ label, value, mono, vc }: { label: string; value: string; mono?: boolean; vc?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn(mono ? "font-mono" : "", vc ?? "text-slate-300")}>{value}</span>
    </div>
  );
}

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Register" },
  { key: "pending", label: "Awaiting Approval" },
  { key: "approved", label: "Approved" },
  { key: "vpn_ready", label: "Done" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center w-full mb-8">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0",
              i < idx ? "bg-emerald-500 border-emerald-500 text-white"
              : i === idx ? "bg-slate-800 border-emerald-400 text-emerald-400"
              : "bg-slate-800 border-slate-600 text-slate-500",
            )}>
              {i < idx ? <CheckCircle size={13} /> : i + 1}
            </div>
            <span className={cn(
              "text-[9px] text-center leading-tight whitespace-nowrap",
              i === idx ? "text-emerald-400" : i < idx ? "text-emerald-500" : "text-slate-500",
            )}>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-px mx-1 mb-4", i < idx ? "bg-emerald-500" : "bg-slate-700")} />
          )}
        </div>
      ))}
    </div>
  );
}

function RegistrationForm({ onDone }: { onDone: (mac: string, s: DeviceStatus) => void }) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null);
  const [mac, setMac] = useState("");
  const [label, setLabel] = useState("");
  const [networkId, setNetworkId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Network[]>("/networks").then(setNetworks).catch(() => {});
    apiFetch<Fingerprint>("/device/fingerprint").then((fp) => {
      setFingerprint(fp);
      setLabel(fp.hostname); // auto-fill label with detected hostname
    }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) { setError("Please select a network"); return; }
    setError(null); setLoading(true);
    try {
      const result = await apiFetch<DeviceStatus>("/device/register", {
        method: "POST",
        body: JSON.stringify({ mac, label, network_id: networkId }),
      });
      onDone(mac, result);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  const cls = "w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500";
  return (
    <form onSubmit={submit} className="space-y-4">
      {fingerprint && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Detected from your device</p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">IP Address</span>
            <span className="font-mono text-emerald-300">{fingerprint.ip}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Device Type</span>
            <span className="text-slate-300">{fingerprint.hostname}</span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Device Label / Hostname</label>
        <input required value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. My Phone" maxLength={128} className={cls} />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">MAC Address</label>
        <input required value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())}
          placeholder="AA:BB:CC:DD:EE:FF"
          pattern="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"
          className={cn(cls, "font-mono")} />
        <p className="text-[10px] text-slate-500">Find in: Settings &rarr; About &rarr; WiFi MAC Address</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-slate-400">Network</label>
        <select required value={networkId} onChange={(e) => setNetworkId(Number(e.target.value))} className={cls}>
          <option value="">Select a network...</option>
          {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2.5 text-red-300 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" /> {error}
        </div>
      )}
      <button type="submit" disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? "Submitting..." : <><span>Register Device</span><ChevronRight size={15} /></>}
      </button>
    </form>
  );
}

function PendingStep({ mac, deviceId, onApproved }: { mac: string; deviceId: number; onApproved: (s: DeviceStatus) => void }) {
  const [dots, setDots] = useState(".");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const dotTimer = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 600);
    pollRef.current = setInterval(async () => {
      try {
        const s = await apiFetch<DeviceStatus>(`/device/status/${encodeURIComponent(mac)}`);
        if (s.approved) { clearInterval(pollRef.current!); clearInterval(dotTimer); onApproved(s); }
      } catch { /* ignore */ }
    }, 5000);
    return () => { clearInterval(dotTimer); if (pollRef.current) clearInterval(pollRef.current); };
  }, [mac, onApproved]);
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
          <Clock size={28} className="text-amber-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Awaiting Network Monitor Approval</p>
        <p className="text-slate-400 text-sm">Your request has been submitted. A Network Monitor will review and approve your device.</p>
      </div>
      <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-left space-y-1.5">
        <Row label="Device ID" value={`#${deviceId}`} mono />
        <Row label="MAC Address" value={mac} mono />
        <Row label="Status" value="pending" mono vc="text-amber-400" />
      </div>
      <p className="text-slate-500 text-xs">Checking for approval{dots}</p>
    </div>
  );
}

function ApprovedStep({ status, onDone }: { status: DeviceStatus; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  function copySignature() {
    if (!status.signature) return;
    safeCopy(status.signature).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  // Store credentials in localStorage for the portal
  useEffect(() => {
    if (status.signature) {
      localStorage.setItem("omg_mac", status.mac);
      localStorage.setItem("omg_signature", status.signature);
      localStorage.setItem("omg_device_id", String(status.device_id));
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <CheckCircle size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Device Approved</p>
        <p className="text-slate-400 text-sm">Your device has been verified. Your digital signature is ready.</p>
      </div>
      <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-left space-y-1.5">
        <Row label="Device ID" value={`#${status.device_id}`} mono />
        <Row label="MAC Address" value={status.mac} mono />
        <Row label="IP Address" value={status.ip} mono vc="text-emerald-300" />
        <Row label="Hostname" value={status.hostname} mono />
        <Row label="Status" value={status.status} mono vc="text-emerald-400" />
      </div>
      {status.signature && (
        <div className="w-full space-y-1">
          <p className="text-xs text-slate-400 text-left">Digital Signature (HMAC-SHA256)</p>
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-[10px] font-mono text-slate-300 truncate flex-1">{status.signature}</span>
            <button onClick={copySignature} className="text-slate-400 hover:text-emerald-400 flex-shrink-0">
              {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-left">Saved to device. Used for automatic login.</p>
        </div>
      )}
      <button onClick={onDone}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        <Wifi size={15} /> Go to File Portal
      </button>
    </div>
  );
}

function DoneStep({ status }: { status: DeviceStatus }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <Wifi size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Registration Complete</p>
        <p className="text-slate-400 text-sm">Your credentials are saved. You can now access the file portal.</p>
      </div>
      <div className="w-full bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">IP Address</span>
        <span className="text-xs font-mono text-emerald-300">{status.ip}</span>
      </div>
      <a href="/portal"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        Open File Portal
      </a>
    </div>
  );
}

export default function DeviceRegistrationPage() {
  const [step, setStep] = useState<Step>("form");
  const [mac, setMac] = useState("");
  const [deviceId, setDeviceId] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  function onRegistered(registeredMac: string, s: DeviceStatus) {
    setMac(registeredMac); setDeviceId(s.device_id); setDeviceStatus(s);
    setStep(s.approved ? "approved" : "pending");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Shield size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="font-bold text-sm text-slate-100 leading-tight">Oh-My-Guard!</p>
          <p className="text-[10px] text-slate-500 leading-tight">Device Registration</p>
        </div>
      </div>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
        <StepBar current={step} />
        {step === "form" && <RegistrationForm onDone={onRegistered} />}
        {step === "pending" && <PendingStep mac={mac} deviceId={deviceId} onApproved={(s) => { setDeviceStatus(s); setStep("approved"); }} />}
        {step === "approved" && deviceStatus && <ApprovedStep status={deviceStatus} onDone={() => setStep("vpn_ready")} />}
        {step === "vpn_ready" && deviceStatus && <DoneStep status={deviceStatus} />}
      </div>
      <p className="mt-6 text-[11px] text-slate-600 text-center max-w-xs">
        Credentials are bound to your MAC address, IP, and hostname. All three must match on every login.
      </p>
    </div>
  );
}
'''

import os
dst = r"artifacts/oh-my-guard/src/pages/DeviceRegistrationPage.tsx"
with open(dst, "w", encoding="utf-8") as f:
    f.write(content)
print("Written", os.path.getsize(dst), "bytes")
