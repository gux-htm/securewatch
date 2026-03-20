import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

interface Integration {
  id: string;
  name: string;
  type: string;
  method: string;
  version: string;
  registeredAt: string;
  lastEventAt: string | null;
  status: 'ACTIVE' | 'DEGRADED' | 'SILENT' | 'DISCONNECTED';
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  ACTIVE:       { dot: 'bg-green-text',    text: 'text-green-text' },
  DEGRADED:     { dot: 'bg-high-text',     text: 'text-high-text' },
  SILENT:       { dot: 'bg-critical-text', text: 'text-critical-text' },
  DISCONNECTED: { dot: 'bg-text-muted',    text: 'text-text-muted' },
};

const ROW_BG: Record<string, string> = {
  ACTIVE:       '',
  DEGRADED:     '',
  SILENT:       'bg-critical-bg',
  DISCONNECTED: '',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
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

const TYPES   = ['DATABASE', 'FILE_SYSTEM', 'APPLICATION', 'CLOUD', 'LEGACY', 'DIRECTORY'];
const METHODS = ['AGENT', 'API', 'LOG_PARSER', 'SDK', 'FILE_WATCHER'];

export default function Integrations() {
  const token = useAuthStore((s) => s.token);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ name: '', type: 'APPLICATION', method: 'AGENT' });
  const [submitting, setSubmitting]     = useState(false);

  const fetchIntegrations = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/integrations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Integration[]) => { setIntegrations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchIntegrations();
    const interval = setInterval(fetchIntegrations, 30_000);
    return () => clearInterval(interval);
  }, [fetchIntegrations]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name) return;
    setSubmitting(true);
    fetch('/api/v1/integrations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then((created: Integration) => {
        setIntegrations((prev) => [...prev, created]);
        setShowForm(false);
        setForm({ name: '', type: 'APPLICATION', method: 'AGENT' });
      })
      .finally(() => setSubmitting(false));
  }

  const counts = {
    ACTIVE:       integrations.filter((i) => i.status === 'ACTIVE').length,
    DEGRADED:     integrations.filter((i) => i.status === 'DEGRADED').length,
    SILENT:       integrations.filter((i) => i.status === 'SILENT').length,
    DISCONNECTED: integrations.filter((i) => i.status === 'DISCONNECTED').length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Integration Health</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Integration'}
          </button>
          <button
            onClick={fetchIntegrations}
            className="bg-bg-tertiary border border-border px-3 py-2 rounded text-sm text-text-primary hover:border-accent-blue transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-bg-secondary border border-border rounded-md p-4 flex items-center gap-3 flex-wrap"
        >
          <input
            required
            placeholder="System name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-48"
          />
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none"
          >
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-4 gap-4">
        {(['ACTIVE', 'DEGRADED', 'SILENT', 'DISCONNECTED'] as const).map((s) => {
          const st = STATUS_STYLES[s];
          return (
            <div key={s} className="bg-bg-secondary border border-border rounded-md p-4 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${st.dot}`} />
                {loading ? '—' : counts[s]}
              </div>
              <div className="text-sm text-text-secondary mt-1">{s.charAt(0) + s.slice(1).toLowerCase()}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">System</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Method</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Last Event</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} />)
            ) : integrations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                  No integrations registered yet
                </td>
              </tr>
            ) : (
              integrations.map((intg) => {
                const st = STATUS_STYLES[intg.status] ?? STATUS_STYLES['DISCONNECTED'];
                return (
                  <tr
                    key={intg.id}
                    className={`border-b border-border hover:bg-bg-hover transition-colors cursor-pointer ${ROW_BG[intg.status] ?? ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-text-primary">{intg.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{intg.type}</td>
                    <td className="px-4 py-3 text-text-secondary">{intg.method}</td>
                    <td className={`px-4 py-3 font-medium ${st.text} flex items-center gap-1.5`}>
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      {intg.status}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {timeAgo(intg.lastEventAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border text-sm text-text-secondary">
          {loading ? 'Loading…' : `${integrations.length} integration${integrations.length !== 1 ? 's' : ''} · refreshes every 30s`}
        </div>
      </div>
    </div>
  );
}
