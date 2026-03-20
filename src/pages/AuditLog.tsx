import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, FileText } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface AuditEntry {
  id: string;
  occurredAt: string;
  eventType: string;
  category: string;
  accountId: string | null;
  sourceIp: string | null;
  resourcePath: string | null;
  outcome: string;
  failedLayer: string | null;
  sourceSystem: string | null;
  hmac: string;
}

interface AuditResponse {
  total: number;
  limit: number;
  offset: number;
  rows: AuditEntry[];
}

const LIMIT = 50;

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    ALLOWED: 'bg-green-bg text-green-text border border-green-border',
    DENIED: 'bg-critical-bg text-critical-text border border-critical-border',
    ERROR: 'bg-high-bg text-high-text border border-high-border',
  };
  const cls = styles[outcome] ?? 'bg-bg-tertiary text-text-secondary border border-border';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {outcome}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[1,2,3,4,5,6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-bg-hover rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function AuditLog() {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingOutcome, setPendingOutcome] = useState('');

  const fetchLog = useCallback(async (off: number, q: string, out: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (q) params.set('search', q);
      if (out) params.set('outcome', out);
      const res = await fetch(`/api/v1/audit-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data: AuditResponse = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchLog(offset, search, outcome); }, [fetchLog, offset, search, outcome]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void fetchLog(offset, search, outcome); }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLog, offset, search, outcome]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setSearch(pendingSearch);
    setOutcome(pendingOutcome);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>
          <span className="text-xs text-text-muted font-mono ml-2">{total.toLocaleString()} events</span>
        </div>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors ${autoRefresh ? 'bg-accent-blue-subtle border-accent-blue text-accent-blue' : 'bg-bg-tertiary border-border text-text-secondary hover:text-text-primary'}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
      </div>

      <div className="bg-accent-blue-subtle border border-accent-blue rounded px-4 py-2 text-xs text-low-text">
        File system events are ingested by the watcher. Run{' '}
        <code className="font-mono bg-bg-tertiary px-1 rounded">npm run watcher</code>{' '}
        in <code className="font-mono bg-bg-tertiary px-1 rounded">services/rest-api</code> to start monitoring.
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search event type, resource path, IP..."
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
          />
        </div>
        <select
          value={pendingOutcome}
          onChange={(e) => setPendingOutcome(e.target.value)}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        >
          <option value="">All outcomes</option>
          <option value="ALLOWED">ALLOWED</option>
          <option value="DENIED">DENIED</option>
          <option value="ERROR">ERROR</option>
        </select>
        <button type="submit" className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2 rounded text-sm transition-colors">
          Search
        </button>
      </form>

      <div className="bg-bg-secondary border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Event Type</th>
              <th className="px-4 py-3 text-left">Outcome</th>
              <th className="px-4 py-3 text-left">File / Resource</th>
              <th className="px-4 py-3 text-left">Source IP</th>
              <th className="px-4 py-3 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted">No audit events found</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">{new Date(row.occurredAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{row.eventType}</td>
                  <td className="px-4 py-3"><OutcomeBadge outcome={row.outcome} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary max-w-[240px] truncate" title={row.resourcePath ?? ''}>{row.resourcePath ?? <span className="text-text-muted">-</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.sourceIp ?? <span className="text-text-muted">-</span>}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary">{row.sourceSystem ?? row.category ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Page {currentPage} of {totalPages} - {total.toLocaleString()} total</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))} className="px-3 py-1.5 rounded border border-border bg-bg-tertiary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)} className="px-3 py-1.5 rounded border border-border bg-bg-tertiary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}