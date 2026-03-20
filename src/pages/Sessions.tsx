import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

interface Session {
  id: string;
  accountId: string;
  username: string;
  sourceIp: string | null;
  deviceId: string | null;
  deviceFingerprint: string | null;
  loginAt: string;
  lastActive: string;
  status: 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
}

const STATUS_STYLES: Record<string, string> = {
  CLEAN:      'bg-bg-tertiary border border-border text-text-primary',
  SUSPICIOUS: 'bg-high-bg border border-high-border text-high-text',
  CRITICAL:   'bg-critical-bg border border-critical-border text-critical-text',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-bg-tertiary rounded w-24" />
        </td>
      ))}
      <td className="px-4 py-3" />
    </tr>
  );
}

export default function Sessions() {
  const token = useAuthStore((s) => s.token);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const fetchSessions = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Session[]) => { setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10_000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  function terminate(id: string) {
    if (!token) return;
    fetch(`/api/v1/sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => setSessions((prev) => prev.filter((s) => s.id !== id)));
  }

  const filtered = sessions.filter((s) =>
    !search ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.sourceIp ?? '').includes(search) ||
    (s.deviceFingerprint ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const criticalCount = sessions.filter((s) => s.status === 'CRITICAL').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-text-primary">Live Sessions</h1>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-green-text animate-pulse" />
            {loading ? '…' : sessions.length} active
            {criticalCount > 0 && (
              <span className="ml-2 text-critical-text font-medium">
                · {criticalCount} CRITICAL
              </span>
            )}
            <span className="ml-2">↻ every 10s</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by username, IP, or device…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-72"
        />
      </div>

      <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Username</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Source IP</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Device</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Login</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                  {search ? 'No sessions match your search' : 'No active sessions'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-border transition-colors ${
                    s.status === 'CRITICAL'
                      ? 'bg-critical-bg border-l-4 border-l-critical-border hover:opacity-90'
                      : 'hover:bg-bg-hover'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-text-primary">
                    {s.username}
                    {s.status === 'CRITICAL' && (
                      <span className="ml-2 text-critical-text">⚠</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary">
                    {s.sourceIp ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">
                    {s.deviceFingerprint ?? (s.deviceId ? s.deviceId.slice(0, 8) : '—')}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">
                    {timeAgo(s.loginAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_STYLES[s.status] ?? STATUS_STYLES['CLEAN']}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => terminate(s.id)}
                      className="text-xs text-critical-text hover:underline font-medium"
                    >
                      Terminate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-text-secondary">
          <span>
            {loading ? 'Loading…' : `${filtered.length} of ${sessions.length} sessions`}
          </span>
        </div>
      </div>
    </div>
  );
}
