content = r'''import { useState, useEffect, useRef } from "react";
import { Shield, CheckCircle, Clock, AlertTriangle, ChevronRight, User, Lock, Fingerprint, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "detecting" | "form" | "pending" | "setup" | "passkey" | "done";

interface Network { id: number; name: string; }
interface Fingerprint { ip: string; mac: string | null; hostname: string; user_agent: string; }
interface DeviceStatus {
  device_id: number; mac: string; ip: string; hostname: string;
  status: string; approved: boolean; needs_setup: boolean; signature: string | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Request" },
  { key: "pending", label: "Approval" },
  { key: "setup", label: "Account" },
  { key: "passkey", label: "Passkey" },
  { key: "done", label: "Done" },
];

function StepBar({ current }: { current: Step }) {
  const visibleKeys = STEPS.map(s => s.key);
  const idx = visibleKeys.indexOf(current);
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
            <span className={cn("text-[9px] text-center leading-tight whitespace-nowrap",
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

// ─── Step 1: Detecting + Form ─────────────────────────────────────────────────

function RequestForm({ onSubmitted }: { onSubmitted: (mac: string, s: DeviceStatus) => void }) {
  const [fp, setFp] = useState<Fingerprint | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [mac, setMac] = useState("");
  const [label, setLabel] = useState("");
  const [networkId, setNetworkId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Network[]>("/networks").then(setNetworks).catch(() => {});
    // Poll fingerprint until MAC is detected (ARP table may need a moment)
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      try {
        const f = await api<Fingerprint>("/device/fingerprint");
        setFp(f);
        if (f.mac) {
          setMac(f.mac);
          setLabel(f.hostname);
          setDetecting(false);
          clearInterval(poll);
        } else if (tries >= 10) {
          setDetecting(false);
          clearInterval(poll);
        }
        setAttempts(tries);
      } catch { if (tries >= 10) { setDetecting(false); clearInterval(poll); } }
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) { setError("Please select a network"); return; }
    setError(null); setLoading(true);
    try {
      const result = await api<DeviceStatus>("/device/register", {
        method: "POST",
        body: JSON.stringify({ mac, label, network_id: networkId }),
      });
      onSubmitted(mac, result);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  const cls = "w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500";

  return (
    <div className="space-y-4">
      {/* Detection banner */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2.5 space-y-1.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Auto-detected</p>
        {fp ? (
          <>
            <div className="flex justify-between text-xs"><span className="text-slate-400">IP</span><span className="font-mono text-emerald-300">{fp.ip}</span></div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">MAC</span>
              {fp.mac
                ? <span className="font-mono text-emerald-300">{fp.mac}</span>
                : <span className="text-amber-400 text-[11px]">Not detected yet ({attempts}/10)…</span>}
            </div>
            <div className="flex justify-between text-xs"><span className="text-slate-400">Device</span><span className="text-slate-300">{fp.hostname}</span></div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            Detecting your device…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Device Label</label>
          <input required value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. My Phone" maxLength={128} className={cls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">MAC Address {fp?.mac ? <span className="text-emerald-400">(auto-detected)</span> : <span className="text-amber-400">(enter manually)</span>}</label>
          <input required value={mac} onChange={e => setMac(e.target.value.toUpperCase())}
            placeholder="AA:BB:CC:DD:EE:FF" pattern="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"
            readOnly={!!fp?.mac}
            className={cn(cls, "font-mono", fp?.mac ? "opacity-70 cursor-not-allowed" : "")} />
          {!fp?.mac && <p className="text-[10px] text-slate-500">Settings → About → WiFi MAC Address</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Network</label>
          <select required value={networkId} onChange={e => setNetworkId(Number(e.target.value))} className={cls}>
            <option value="">Select a network…</option>
            {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">
            <AlertTriangle size={13} className="flex-shrink-0" /> {error}
          </div>
        )}
        <button type="submit" disabled={loading || detecting}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
          {loading ? "Sending request…" : detecting ? "Detecting device…" : <><span>Send Registration Request</span><ChevronRight size={15} /></>}
        </button>
      </form>
    </div>
  );
}

// ─── Step 2: Pending ──────────────────────────────────────────────────────────

function PendingStep({ mac, deviceId, onApproved }: { mac: string; deviceId: number; onApproved: (s: DeviceStatus) => void }) {
  const [dots, setDots] = useState(".");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const dotTimer = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
    pollRef.current = setInterval(async () => {
      try {
        const s = await api<DeviceStatus>(`/device/status/${encodeURIComponent(mac)}`);
        if (s.approved) { clearInterval(pollRef.current!); clearInterval(dotTimer); onApproved(s); }
      } catch {}
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
        <p className="text-slate-200 font-medium">Request Sent to Admin</p>
        <p className="text-slate-400 text-sm">Your IP, MAC, and device name have been sent for approval. Waiting for the Network Monitor to approve your request.</p>
      </div>
      <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-left space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-slate-500">Device ID</span><span className="font-mono text-slate-300">#{deviceId}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">MAC</span><span className="font-mono text-slate-300">{mac}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-amber-400">pending_approval</span></div>
      </div>
      <p className="text-slate-500 text-xs">Checking for approval{dots}</p>
    </div>
  );
}

// ─── Step 3: Setup credentials ────────────────────────────────────────────────

function SetupStep({ deviceId, mac, onDone }: { deviceId: number; mac: string; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setError(null); setLoading(true);
    try {
      await api("/device/setup-credentials", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId, mac, username, password }),
      });
      onDone();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  const cls = "w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-400 mb-2">
        <CheckCircle size={16} />
        <span className="text-sm font-medium">Request Approved!</span>
      </div>
      <p className="text-slate-400 text-sm">Create your account credentials. You will use these to log in.</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-400 flex items-center gap-1"><User size={11} /> Username</label>
          <input required value={username} onChange={e => setUsername(e.target.value)}
            placeholder="e.g. gulraiz" minLength={3} maxLength={64}
            pattern="^[a-zA-Z0-9_-]+$" className={cls} />
          <p className="text-[10px] text-slate-500">Letters, numbers, _ and - only</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400 flex items-center gap-1"><Lock size={11} /> Password</label>
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min 8 characters" minLength={8} className={cls} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Confirm Password</label>
          <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat password" className={cls} />
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">
            <AlertTriangle size={13} className="flex-shrink-0" /> {error}
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
          {loading ? "Creating account…" : <><span>Continue</span><ChevronRight size={15} /></>}
        </button>
      </form>
    </div>
  );
}

// ─── Step 4: Passkey ──────────────────────────────────────────────────────────

function PasskeyStep({ deviceId, mac, onDone }: { deviceId: number; mac: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createPasskey() {
    setError(null); setLoading(true);
    try {
      // 1. Get challenge from server
      const options = await api<PublicKeyCredentialCreationOptions & { challenge: string; user: { id: string } }>("/device/passkey/register/begin", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId, mac }),
      });

      // 2. Convert base64 fields to ArrayBuffer for WebAuthn API
      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, "").replace(/_/g, "/")), c => c.charCodeAt(0)).buffer,
        user: {
          ...options.user,
          id: Uint8Array.from(atob(options.user.id), c => c.charCodeAt(0)).buffer,
        },
      };

      // 3. Trigger biometric prompt
      const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
      if (!credential) throw new Error("Passkey creation cancelled");

      const response = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server
      await api("/device/passkey/register/complete", {
        method: "POST",
        body: JSON.stringify({
          device_id: deviceId,
          mac,
          credential: {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
            type: credential.type,
            response: {
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
              attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
            },
          },
        }),
      });

      onDone();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("cancelled") || msg.includes("NotAllowedError")) {
        setError("Biometric prompt was cancelled. Please try again.");
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  }

  const passkeySupported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <Fingerprint size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Create Your Passkey</p>
        <p className="text-slate-400 text-sm">A passkey lets you log in with your fingerprint or face — no password needed next time. It is stored securely on this device only.</p>
      </div>

      {!passkeySupported && (
        <div className="w-full bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2.5 text-amber-300 text-xs">
          Your browser does not support passkeys. You can still log in with your password.
        </div>
      )}

      {error && (
        <div className="w-full flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" /> {error}
        </div>
      )}

      {passkeySupported && (
        <button onClick={createPasskey} disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-3 rounded-lg flex items-center justify-center gap-2">
          <Fingerprint size={16} />
          {loading ? "Waiting for biometric…" : "Create Passkey with Biometrics"}
        </button>
      )}

      <button onClick={onDone} className="text-xs text-slate-500 hover:text-slate-300 underline">
        Skip for now — use password login
      </button>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function DoneStep() {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <Wifi size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">Registration Complete</p>
        <p className="text-slate-400 text-sm">Your account is ready. Log in to access the file portal.</p>
      </div>
      <a href="/portal"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
        Go to Portal Login
      </a>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DeviceRegistrationPage() {
  const [step, setStep] = useState<Step>("form");
  const [mac, setMac] = useState("");
  const [deviceId, setDeviceId] = useState(0);

  function onSubmitted(registeredMac: string, s: DeviceStatus) {
    setMac(registeredMac); setDeviceId(s.device_id);
    if (s.needs_setup) setStep("setup");
    else if (s.approved) setStep("done");
    else setStep("pending");
  }

  function onApproved(s: DeviceStatus) {
    setDeviceId(s.device_id);
    setStep("setup");
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
        <StepBar current={step === "detecting" ? "form" : step} />
        {(step === "form" || step === "detecting") && <RequestForm onSubmitted={onSubmitted} />}
        {step === "pending" && <PendingStep mac={mac} deviceId={deviceId} onApproved={onApproved} />}
        {step === "setup" && <SetupStep deviceId={deviceId} mac={mac} onDone={() => setStep("passkey")} />}
        {step === "passkey" && <PasskeyStep deviceId={deviceId} mac={mac} onDone={() => setStep("done")} />}
        {step === "done" && <DoneStep />}
      </div>

      <p className="mt-6 text-[11px] text-slate-600 text-center max-w-xs">
        Your IP, MAC, and device name are automatically detected and bound to your account.
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
