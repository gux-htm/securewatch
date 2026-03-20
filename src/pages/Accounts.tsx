import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface Account {
  id: string;
  username: string;
  email: string | null;
  role: string;
  status: string;
  registeredAt: string;
  lastVerifiedAt: string | null;
}

interface CreatedAccount {
  id: string;
  username: string;
  email: string | null;
  role: string;
  status: string;
  totpSecret: string;
}

interface MfaQrData {
  qrDataUrl: string;
  secret: string;
  mfaEnabled: boolean;
  otpauth: string;
}

const ROLE_DOT: Record<string, string> = {
  ADMIN:   'bg-accent-blue',
  USER:    'bg-green-text',
  SERVICE: 'bg-text-muted',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'text-green-text',
  SUSPENDED: 'text-critical-text',
  REVOKED:   'text-high-text',
  EXPIRED:   'text-text-muted',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-bg-tertiary rounded w-24" />
        </td>
      ))}
    </tr>
  );
}

// ── MFA Setup Modal ───────────────────────────────────────────────────────────

function MfaSetupModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [qrData, setQrData]     = useState<MfaQrData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [code, setCode]         = useState('');
  const [verifying, setVerifying] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/mfa-qr', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: MfaQrData) => { setQrData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch('/api/v1/auth/mfa-enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: code }),
      });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        setError(d.error ?? 'Invalid code');
        return;
      }
      setDone(true);
    } catch {
      setError('Request failed');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <Shield className="w-5 h-5 text-accent-blue" />
            Set Up Two-Factor Authentication
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">✕</button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="w-12 h-12 text-green-text" />
            <p className="text-text-primary font-medium">MFA enabled successfully</p>
            <p className="text-sm text-text-secondary text-center">
              Your account is now protected with two-factor authentication.
              You'll need your authenticator app on next login.
            </p>
            <button
              onClick={onClose}
              className="mt-2 bg-accent-blue hover:bg-accent-blue-hover text-white px-6 py-2 rounded text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-3/4" />
            <div className="h-64 bg-bg-tertiary rounded" />
            <div className="h-10 bg-bg-tertiary rounded" />
          </div>
        ) : !qrData ? (
          <div className="text-critical-text text-sm">Failed to load QR code</div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-text-secondary">
                1. Open Google Authenticator (or Authy) and tap <span className="text-text-primary">+</span>
              </p>
              <p className="text-sm text-text-secondary">
                2. Choose <span className="text-text-primary">Scan a QR code</span> and scan the image below
              </p>
              <p className="text-sm text-text-secondary">
                3. Enter the 6-digit code to confirm
              </p>
            </div>

            {/* QR Code — actual scannable image */}
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg inline-block">
                <img
                  src={qrData.qrDataUrl}
                  alt="TOTP QR Code — scan with authenticator app"
                  width={200}
                  height={200}
                  className="block"
                />
              </div>
            </div>

            {/* Manual entry fallback */}
            <div className="bg-bg-tertiary border border-border rounded p-3 flex flex-col gap-1">
              <span className="text-xs text-text-muted">Can't scan? Enter this key manually:</span>
              <span className="font-mono text-sm text-text-primary select-all tracking-widest">
                {qrData.secret.match(/.{1,4}/g)?.join(' ') ?? qrData.secret}
              </span>
            </div>

            {/* Verify form */}
            <form onSubmit={handleVerify} className="flex flex-col gap-3">
              {error && (
                <div className="px-3 py-2 rounded bg-critical-bg border border-critical-border text-critical-text text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Enter the 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="bg-bg-primary border border-border rounded px-3 py-2 text-text-primary font-mono text-lg tracking-widest text-center focus:border-accent-blue outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white py-2.5 rounded font-medium text-sm transition-colors"
              >
                {verifying ? 'Verifying…' : 'Verify & Enable MFA'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Accounts() {
  const token = useAuthStore((s) => s.token);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated]       = useState<CreatedAccount | null>(null);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' });

  const fetchAccounts = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: Account[]) => { setAccounts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);

    fetch('/api/v1/accounts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, email: form.email || null, password: form.password, role: form.role }),
    })
      .then(async (r) => {
        if (r.status === 409) { setError('Username already exists'); return; }
        if (!r.ok)            { setError('Failed to create account'); return; }
        const data = await r.json() as CreatedAccount;
        setCreated(data);
        setAccounts((prev) => [{ ...data, registeredAt: new Date().toISOString(), lastVerifiedAt: null }, ...prev]);
        setShowForm(false);
        setForm({ username: '', email: '', password: '', role: 'USER' });
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <>
      {showMfaSetup && token && (
        <MfaSetupModal token={token} onClose={() => setShowMfaSetup(false)} />
      )}

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Account Management</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMfaSetup(true)}
              className="bg-bg-tertiary border border-border hover:border-accent-blue text-text-primary px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-accent-blue" />
              Set Up MFA
            </button>
            <button
              onClick={() => { setShowForm((v) => !v); setError(null); setCreated(null); }}
              className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              {showForm ? 'Cancel' : '+ Create Account'}
            </button>
          </div>
        </div>

        {/* TOTP secret reveal — shown once after creation */}
        {created && (
          <div className="bg-bg-secondary border border-green-border rounded-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-text flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Account created — save the TOTP secret now, it will not be shown again
              </span>
              <button onClick={() => setCreated(null)} className="text-text-muted hover:text-text-primary text-lg leading-none">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Username</span>
                <span className="font-mono text-text-primary">{created.username}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Role</span>
                <span className="text-text-primary">{created.role}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-secondary">TOTP Secret (Base32) — add to authenticator app</span>
              <span className="font-mono text-green-text bg-bg-tertiary px-3 py-2 rounded text-sm select-all tracking-widest">
                {created.totpSecret.match(/.{1,4}/g)?.join(' ') ?? created.totpSecret}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              The account holder should go to Settings → Set Up MFA to scan the QR code and activate two-factor authentication.
            </p>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-bg-secondary border border-border rounded-md p-4 flex flex-col gap-4">
            <span className="text-sm font-semibold text-text-primary">New Account</span>
            {error && (
              <div className="px-3 py-2 rounded bg-critical-bg border border-critical-border text-critical-text text-sm">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Username *</label>
                <input required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:border-accent-blue outline-none" placeholder="john.doe" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:border-accent-blue outline-none" placeholder="john@example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Password *</label>
                <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:border-accent-blue outline-none" placeholder="Min 8 characters" minLength={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:border-accent-blue outline-none">
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SERVICE">SERVICE</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={submitting}
                className="bg-accent-blue hover:bg-accent-blue-hover text-white px-5 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50">
                {submitting ? 'Creating…' : 'Create Account'}
              </button>
              <span className="text-xs text-text-muted">A TOTP secret will be generated — save it immediately.</span>
            </div>
          </form>
        )}

        {/* Accounts table */}
        <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-tertiary">
                {['Username', 'Email', 'Role', 'Status', 'MFA', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonRow key={i} />)
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">No accounts yet</td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-text-primary">{a.username}</td>
                    <td className="px-4 py-3 text-text-secondary">{a.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                        <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[a.role] ?? 'bg-text-muted'}`} />
                        {a.role}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${STATUS_STYLES[a.status] ?? 'text-text-secondary'}`}>
                      {a.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">—</td>
                    <td className="px-4 py-3 font-mono text-text-secondary text-xs">{timeAgo(a.registeredAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border text-sm text-text-secondary">
            {loading ? 'Loading…' : `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>
    </>
  );
}
