import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE = '';

// Deterministic device fingerprint — no external library needed
function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  return btoa(raw);
}

export default function Login() {
  const navigate   = useNavigate();
  const setAuth    = useAuthStore((s) => s.setAuth);

  const [step, setStep]           = useState<1 | 2>(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Step 1 fields
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [tenantId, setTenantId]   = useState('00000000-0000-0000-0000-000000000001');

  // Step 2 fields — preAuthToken lives in component state only, never localStorage
  const preAuthTokenRef           = useRef<string>('');
  const [digits, setDigits]       = useState(['', '', '', '', '', '']);
  const digitRefs                 = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  // ── Step 1: credentials ────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password, tenantId }),
      });

      if (!res.ok) {
        setError('Authentication failed. Please try again.');
        return;
      }

      const data = await res.json() as { preAuthToken?: string; token?: string; expiresAt?: string; mfaRequired?: boolean };

      // MFA disabled — server issued JWT directly, skip step 2
      if (data.mfaRequired === false && data.token && data.expiresAt) {
        setAuth(data.token, data.expiresAt);
        navigate('/inbox');
        return;
      }

      if (!data.preAuthToken) {
        setError('Authentication failed. Please try again.');
        return;
      }
      preAuthTokenRef.current = data.preAuthToken;
      setStep(2);
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: TOTP ───────────────────────────────────────────────────────────
  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const totpCode = digits.join('');
    if (totpCode.length !== 6) {
      setError('Authentication failed. Please try again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/mfa`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          preAuthToken:      preAuthTokenRef.current,
          totpCode,
          deviceFingerprint: getDeviceFingerprint(),
          sourceIp:          '127.0.0.1',
        }),
      });

      if (!res.ok) {
        setError('Authentication failed. Please try again.');
        return;
      }

      const data = await res.json() as { token: string; expiresAt: string };
      setAuth(data.token, data.expiresAt);
      navigate('/sessions');
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Digit input helpers ────────────────────────────────────────────────────
  function handleDigitChange(idx: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  }

  function handleDigitKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setDigits(pasted.split(''));
      digitRefs.current[5]?.focus();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-8 flex flex-col items-center text-center border-b border-border">
          <Shield className="w-12 h-12 text-accent-blue mb-4" />
          <h1 className="text-xl font-bold text-text-primary">SecureWatch</h1>
          <p className="text-sm text-text-secondary mt-1">Intelligent Security Monitoring System</p>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-border">
          <div className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${step === 1 ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-text-muted'}`}>
            1 — Credentials
          </div>
          <div className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${step === 2 ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-text-muted'}`}>
            2 — Verification
          </div>
        </div>

        <div className="p-8">
          {/* Error banner */}
          {error && (
            <div className="mb-4 px-3 py-2 rounded bg-critical-bg border border-critical-border text-critical-text text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-text-primary mb-2">Admin Login</h2>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Tenant ID</label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary focus:border-accent-blue outline-none font-mono text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary focus:border-accent-blue outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary focus:border-accent-blue outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white py-2.5 rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue →
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-text-primary mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-text-secondary mb-4">
                Open your authenticator app and enter the 6-digit code.
              </p>

              <div className="flex justify-between gap-2 mb-4" onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { digitRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-12 h-12 text-center text-lg bg-bg-tertiary border border-border rounded text-text-primary focus:border-accent-blue outline-none font-mono"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== 6}
                className="bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white py-2.5 rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify & Sign In →
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setDigits(['', '', '', '', '', '']); setError(null); }}
                className="text-sm text-text-secondary hover:text-text-primary mt-1"
              >
                ← Back to credentials
              </button>
            </form>
          )}
        </div>

        <div className="bg-bg-tertiary p-4 text-center border-t border-border">
          <p className="text-xs text-text-secondary flex items-center justify-center gap-1.5">
            <span>🔒</span> All sessions are monitored and logged
          </p>
        </div>
      </div>
    </div>
  );
}
