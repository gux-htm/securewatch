import { useState, useEffect, useCallback } from 'react';
import { Monitor } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface Device {
  id: string;
  fingerprint: string;
  label: string | null;
  os: string | null;
  hostname: string | null;
  status: string;
  registeredAt: string;
  lastSeenAt: string | null;
  accountId: string | null;
  username: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  TRUSTED:   'text-green-text',
  UNTRUSTED: 'text-critical-text',
  PENDING:   'text-high-text',
  REVOKED:   'text-text-muted',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
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

export default function Devices() {
  const token = useAuthStore((s) => s.token);
  const [devices, setDevices]   = useState<Device[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<string>('ALL');

  const fetchDevices = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: Device[]) => { setDevices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  function updateStatus(id: string, status: string) {
    if (!token) return;
    fetch(`/api/v1/devices/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(() => setDevices((prev) =>
      prev.map((d) => d.id === id ? { ...d, status } : d),
    ));
  }

  const filtered = devices.filter((d) => {
    const matchFilter = filter === 'ALL' || d.status === filter;
    const matchSearch = !search ||
      (d.fingerprint ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.hostname ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.label ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    TRUSTED:   devices.filter((d) => d.status === 'TRUSTED').length,
    UNTRUSTED: devices.filter((d) => d.status === 'UNTRUSTED').length,
    PENDING:   devices.filter((d) => d.status === 'PENDING').length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Device Management</h1>
        </div>
        <button
          onClick={fetchDevices}
          className="bg-bg-tertiary border border-border px-3 py-2 rounded text-sm text-text-primary hover:border-accent-blue transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['TRUSTED', 'UNTRUSTED', 'PENDING'] as const).map((s) => (
          <div key={s} className="bg-bg-secondary border border-border rounded-md p-4 flex flex-col items-center justify-center gap-1">
            <span className={`text-2xl font-bold ${STATUS_STYLES[s]}`}>
              {loading ? '—' : counts[s]}
            </span>
            <span className="text-sm text-text-secondary">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search fingerprint, hostname, user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-72"
        />
        <div className="flex items-center gap-1">
          {(['ALL', 'TRUSTED', 'UNTRUSTED', 'PENDING', 'REVOKED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              {['Fingerprint', 'Hostname', 'OS', 'Account', 'Status', 'Last Seen', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                  {search || filter !== 'ALL' ? 'No devices match your filter' : 'No devices registered'}
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-text-primary text-xs">
                    {d.fingerprint.slice(0, 16)}…
                    {d.label && <span className="ml-2 text-text-muted">({d.label})</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">{d.hostname ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{d.os ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">{d.username ?? '—'}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${STATUS_STYLES[d.status] ?? 'text-text-secondary'}`}>
                    {d.status}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">{timeAgo(d.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {d.status !== 'TRUSTED' && (
                        <button
                          onClick={() => updateStatus(d.id, 'TRUSTED')}
                          className="text-xs text-green-text hover:underline"
                        >
                          Trust
                        </button>
                      )}
                      {d.status !== 'REVOKED' && (
                        <button
                          onClick={() => updateStatus(d.id, 'REVOKED')}
                          className="text-xs text-critical-text hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border text-sm text-text-secondary">
          {loading ? 'Loading…' : `${filtered.length} of ${devices.length} device${devices.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}
