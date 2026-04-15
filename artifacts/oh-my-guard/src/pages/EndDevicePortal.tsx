import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Wifi, FileText, Eye, Edit2, ChevronDown, ChevronUp, X, Save, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceIdentity {
  device_id: number; mac: string; label: string;
  static_ip: string; status: string; network_id: number | null;
}
interface FileEntry {
  file_path: string; event_type: string;
  hash_before: string | null; hash_after: string | null; last_modified: string;
}
interface AuditEntry {
  id: number; event_type: string; details: string | null;
  ip_address: string | null; severity: string; created_at: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function getToken(): string | null { return localStorage.getItem("omg_token"); }
function clearToken() { localStorage.removeItem("omg_token"); }

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE = "/api/end-device";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function apiFetchText(path: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.text();
}

// ─── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState(localStorage.getItem("omg_username") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passkeySupported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  async function loginWithPasskey() {
    if (!username) { setError("Enter your username first"); return; }
    setError(null); setLoading(true);
    try {
      const options = await fetch("/api/public/device/passkey/login/begin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      }).then(r => r.json());

      if (options.error) throw new Error(options.error);

      const publicKey: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, "").replace(/_/g, "/")), c => c.charCodeAt(0)).buffer,
        allowCredentials: options.allowCredentials?.map((c: { type: string; id: string }) => ({
          ...c, id: Uint8Array.from(atob(c.id), ch => ch.charCodeAt(0)).buffer,
        })),
      };

      const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
      if (!credential) throw new Error("Passkey authentication cancelled");

      const response = credential.response as AuthenticatorAssertionResponse;
      const result = await fetch("/api/public/device/passkey/login/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          credential: {
            id: credential.id, type: credential.type,
            response: {
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
              signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
            },
          },
        }),
      }).then(r => r.json());

      if (result.error) throw new Error(result.error);
      localStorage.setItem("omg_token", result.token);
      localStorage.setItem("omg_username", username);
      onLogin();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const result = await fetch("/api/public/device/login/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then(r => r.json());
      if (result.error) throw new Error(result.error);
      localStorage.setItem("omg_token", result.token);
      localStorage.setItem("omg_username", username);
      onLogin();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  const cls = "w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Shield size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-sm">Oh-My-Guard!</p>
            <p className="text-[10px] text-slate-500">Device Portal Login</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="your username" className={cls} />
          </div>

          {passkeySupported && (
            <button onClick={loginWithPasskey} disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
              <LogIn size={15} /> {loading ? "Authenticating…" : "Log in with Passkey (Biometrics)"}
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex-1 h-px bg-slate-700" />
            <span>or use password</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <form onSubmit={loginWithPassword} className="space-y-3">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" className={cls} />
            <button type="submit" disabled={loading}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
              <LogIn size={15} /> {loading ? "Logging in…" : "Log in with Password"}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">{error}</div>
        )}

        <p className="text-center text-xs text-slate-500">
          Not registered? <a href="/register" className="text-emerald-400 hover:underline">Register your device</a>
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ type }: { type: string }) {
  const c: Record<string, string> = {
    edit: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    create: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    delete: "bg-red-500/20 text-red-300 border-red-500/30",
    rename: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    view: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", c[type] ?? c["view"])}>{type}</span>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
      <span>{message}</span>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

function FileViewerModal({ file, onClose, onEdit }: { file: FileEntry; onClose: () => void; onEdit: () => void }) {
  const { data: content, isLoading, error } = useQuery({
    queryKey: ["file-content", file.file_path],
    queryFn: () => apiFetchText(`/files/content?path=${encodeURIComponent(file.file_path)}`),
  });
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-300 truncate max-w-[70vw]">{file.file_path}</span>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded flex items-center gap-1">
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-950">
        {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{(error as Error).message}</p>}
        {content !== undefined && (
          <pre className="text-slate-200 font-mono text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
        )}
      </div>
      {(file.hash_before || file.hash_after) && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-700 flex gap-4 text-[10px] font-mono text-slate-400">
          {file.hash_before && <span>before: {file.hash_before.slice(0, 12)}...</span>}
          {file.hash_after && <span>after: {file.hash_after.slice(0, 12)}...</span>}
        </div>
      )}
    </div>
  );
}

function FileEditorModal({ file, onClose, onSaved }: { file: FileEntry; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const { data: original, isLoading } = useQuery<string>({
    queryKey: ["file-content", file.file_path],
    queryFn: () => apiFetchText(`/files/content?path=${encodeURIComponent(file.file_path)}`),
  });
  if (draft === null && original !== undefined) setDraft(original);
  const content = draft ?? original ?? "";

  const save = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/files/content", {
      method: "PUT",
      body: JSON.stringify({ path: file.file_path, content }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["end-device-files"] });
      qc.invalidateQueries({ queryKey: ["file-content", file.file_path] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-300 truncate max-w-[60vw]">{file.file_path}</span>
        <div className="flex gap-2">
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded flex items-center gap-1">
            <Save size={12} /> {save.isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-950">
        {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
        <textarea value={content} onChange={(e) => setDraft(e.target.value)}
          className="w-full h-full min-h-[60vh] bg-transparent text-slate-200 font-mono text-xs resize-none outline-none leading-relaxed"
          spellCheck={false} />
      </div>
      {save.isError && (
        <div className="px-4 py-2 bg-red-900/50 border-t border-red-700 text-red-300 text-xs">
          {(save.error as Error).message}
        </div>
      )}
    </div>
  );
}

function AuditStrip() {
  const [open, setOpen] = useState(false);
  const { data: logs } = useQuery<AuditEntry[]>({
    queryKey: ["end-device-audit"],
    queryFn: () => apiFetch<AuditEntry[]>("/audit?limit=5"),
    refetchInterval: 15_000,
  });
  const sc: Record<string, string> = { info: "text-slate-400", warning: "text-amber-400", error: "text-red-400", critical: "text-red-500" };
  return (
    <div className="border-t border-slate-700 mt-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-xs text-slate-400 hover:text-slate-200">
        <span>Recent audit events</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!logs?.length && <p className="text-slate-500 text-xs">No events yet.</p>}
          {logs?.map((log) => (
            <div key={log.id} className="bg-slate-800/60 rounded p-2.5 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className={cn("text-[10px] font-mono", sc[log.severity] ?? "text-slate-400")}>{log.event_type}</span>
                <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
              {log.details && <p className="text-[11px] text-slate-300 truncate">{log.details}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main portal ──────────────────────────────────────────────────────────────

function Portal() {
  const qc = useQueryClient();
  const [viewFile, setViewFile] = useState<FileEntry | null>(null);
  const [editFile, setEditFile] = useState<FileEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: identity, isLoading: idLoading, error: idError } = useQuery<DeviceIdentity>({
    queryKey: ["end-device-identity"],
    queryFn: () => apiFetch<DeviceIdentity>("/identity"),
    retry: false,
  });

  const { data: files, isLoading: filesLoading } = useQuery<FileEntry[]>({
    queryKey: ["end-device-files"],
    queryFn: () => apiFetch<FileEntry[]>("/files"),
    refetchInterval: 30_000,
  });

  if (idError) {
    clearToken();
    window.location.href = "/portal";
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 max-w-[480px] mx-auto">
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-emerald-400" />
            <span className="font-semibold text-sm">Oh-My-Guard</span>
          </div>
          {identity && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">{identity.mac}</span>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Wifi size={11} /><span>Verified</span>
              </div>
            </div>
          )}
        </div>
        {identity && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-300">{identity.label}</span>
            <span className="text-[10px] font-mono text-slate-500">{identity.static_ip}</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">{identity.status}</span>
          </div>
        )}
      </header>

      <main className="px-4 py-4 space-y-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileText size={12} /> Monitored Files
        </h2>
        {idLoading || filesLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />)}</div>
        ) : !files?.length ? (
          <div className="text-center py-12 text-slate-500 text-sm">No monitored files yet.</div>
        ) : (
          (files as FileEntry[]).map((file) => (
            <div key={file.file_path} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-mono text-slate-200 truncate flex-1" title={file.file_path}>{file.file_path}</p>
                <EventBadge type={file.event_type} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{new Date(file.last_modified).toLocaleString()}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setViewFile(file)} className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded flex items-center gap-1">
                    <Eye size={11} /> View
                  </button>
                  <button onClick={() => setEditFile(file)} className="text-[11px] bg-amber-700/60 hover:bg-amber-600/60 text-amber-200 px-2.5 py-1 rounded flex items-center gap-1">
                    <Edit2 size={11} /> Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <AuditStrip />

      {viewFile && !editFile && (
        <FileViewerModal file={viewFile} onClose={() => setViewFile(null)} onEdit={() => { setEditFile(viewFile); setViewFile(null); }} />
      )}
      {editFile && (
        <FileEditorModal file={editFile} onClose={() => setEditFile(null)} onSaved={() => {
          setEditFile(null);
          qc.invalidateQueries({ queryKey: ["end-device-files"] });
          setToast("File saved. Audit record created.");
          setTimeout(() => setToast(null), 4000);
        }} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Root: show login gate if no token, portal if token present ───────────────

export default function EndDevicePortal() {
  const [authed, setAuthed] = useState(!!getToken());
  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;
  return <Portal />;
}
