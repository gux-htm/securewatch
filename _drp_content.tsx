import { useState, useEffect, useRef } from "react";
import { Shield, Wifi, Download, CheckCircle, Clock, AlertTriangle, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "form" | "pending" | "approved" | "vpn_ready";
interface Network { id: number; name: string; }
interface DeviceStatus {
  device_id: number; mac: string; status: string;
  approved: boolean; static_ip: string | null; signature: string | null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
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
  { key: "vpn_ready", label: "VPN Ready" },
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
  const [mac, setMac] = useState("");
  const [label, setLabel] = useState("");
  const [networkId, setNetworkId] = useState<number | "">("");
  const [requestedIp, setRequestedIp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { apiFetch<Network[]>("/networks").then(setNetworks).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) { setError("Please select a network"); return; }
    setError(null); setLoading(true);
    try {
      const body: Record<string, unknown> = { mac, label, network_id: networkId };
      if (requestedIp.trim()) body.requested_ip = requestedIp.trim();
      const result = await apiFetch<DeviceStatus>("/device/register", { method: "POST", body: JSON.stringify(body) });
      onDone(mac, result);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  const cls = "w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Device Label</label>
        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Alice Laptop" maxLength={128} className={cls} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-400">MAC Address</label>
        <input required value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())} placeholder="AA:BB:CC:DD:EE:FF" pattern="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$" className={cn(cls, "font-mono")} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Network</label>
        <select required value={networkId} onChange={(e) => setNetworkId(Number(e.target.value))} className={cls}>
          <option value="">Select a network...</option>
          {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Requested IP <span className="text-slate-500">(optional)</span></label>
        <input value={requestedIp} onChange={(e) => setRequestedIp(e.target.value)} placeholder="Leave blank to auto-assign" className={cn(cls, "font-mono")} />
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2.5 text-red-300 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" /> {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
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
        <Row label="Status" value="pending_vpn" mono vc="text-amber-400" />
      </div>
      <p className="text-slate-500 text-xs">Checking for approval{dots}</p>
    </div>
  );
}

function ApprovedStep({ status, onVpnIssued }: { status: DeviceStatus; onVpnIssued: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function downloadVpn() {
    setError(null); setLoading(true);
    try {
      const res = await fetch(`/api/devices/${status.device_id}/issue-vpn`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((b as { error?: string }).error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `omg-${status.device_id}.ovpn`; a.click();
      URL.revokeObjectURL(url); onVpnIssued();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  function copySignature() {
    if (!status.signature) return;
    navigator.clipboard.writeText(status.signature).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <CheckCircle size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Device Approved</p>
        <p className="text-slate-400 text-sm">Your device has been approved. Download your VPN config to connect.</p>
      </div>
      <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-left space-y-1.5">
        <Row label="Device ID" value={`#${status.device_id}`} mono />
        <Row label="MAC Address" value={status.mac} mono />
        <Row label="Assigned IP" value={status.static_ip ?? "..."} mono vc="text-emerald-300" />
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
        </div>
      )}
      {error && (
        <div className="w-full flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2.5 text-red-300 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" /> {error}
        </div>
      )}
      <button onClick={downloadVpn} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        <Download size={15} /> {loading ? "Generating VPN config..." : "Download .ovpn Config"}
      </button>
      <p className="text-slate-500 text-[11px]">The config file is deleted from the server after 5 minutes. Keep it safe.</p>
    </div>
  );
}
