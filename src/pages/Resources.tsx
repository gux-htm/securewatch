import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, Hash, Clock, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface Resource {
  id: string;
  name: string;
  path: string | null;
  type: string;
  ownerId: string | null;
  ownerUsername: string | null;
  status: string;
  currentFlag: string;
  lastEventAt: string | null;
  createdAt: string;
  aclCount: number;
}

interface AclEntry {
  id: string;
  granteeId: string;
  granteeUsername: string | null;
  permittedActions: string[];
  grantedAt: string;
  status: string;
  grantedBy: string | null;
}

interface AccessEvent {
  id: string;
  occurredAt: string;
  eventType: string;
  actorId: string | null;
  actorUsername: string | null;
  sourceIp: string | null;
  outcome: 'ALLOWED' | 'DENIED' | 'FLAGGED';
  detail: Record<string, unknown>;
}

interface Account {
  id: string;
  username: string;
}

const TYPE_ICON: Record<string, string> = {
  FILE: '📄', DIRECTORY: '📁', DATABASE: '🗄', TABLE: '📋',
  API: '🔌', SERVICE: '⚙', NETWORK_SHARE: '🌐', APPLICATION: '📦', CUSTOM: '🔧',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'text-green-text', LOCKED: 'text-critical-text', TRANSFERRED: 'text-high-text',
};

const FLAG_DOT: Record<string, string> = {
  CLEAN:      'bg-green-text',
  SUSPICIOUS: 'bg-high-text',
  CRITICAL:   'bg-critical-text',
};
const FLAG_TEXT: Record<string, string> = {
  CLEAN:      'text-green-text',
  SUSPICIOUS: 'text-high-text',
  CRITICAL:   'text-critical-text',
};

const OUTCOME_STYLES: Record<string, string> = {
  ALLOWED: 'text-green-text', DENIED: 'text-critical-text', FLAGGED: 'text-high-text',
};

const OUTCOME_DOT: Record<string, string> = {
  ALLOWED: 'bg-green-text', DENIED: 'bg-critical-text', FLAGGED: 'bg-high-text',
};

const ALL_ACTIONS = ['read', 'write', 'delete', 'rename', 'execute'];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-bg-tertiary rounded w-28" /></td>
      ))}
    </tr>
  );
}

// ── Resource Detail Panel ─────────────────────────────────────────────────────

function ResourceDetail({ resource, token, accounts }: {
  resource: Resource;
  token: string;
  accounts: Account[];
}) {
  const [tab, setTab]           = useState<'acl' | 'events'>('acl');
  const [acl, setAcl]           = useState<AclEntry[]>([]);
  const [events, setEvents]     = useState<AccessEvent[]>([]);
  const [loadingAcl, setLoadingAcl]       = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showAclForm, setShowAclForm]     = useState(false);
  const [aclForm, setAclForm]   = useState({ accountId: '', actions: ['read'] as string[] });
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetch(`/api/v1/resources/${resource.id}/acl`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then((d: AclEntry[]) => { setAcl(d); setLoadingAcl(false); });

    fetch(`/api/v1/resources/${resource.id}/access-events?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then((d: AccessEvent[]) => { setEvents(d); setLoadingEvents(false); });
  }, [resource.id, token]);

  function toggleAction(a: string) {
    setAclForm((f) => ({
      ...f,
      actions: f.actions.includes(a) ? f.actions.filter((x) => x !== a) : [...f.actions, a],
    }));
  }

  function handleGrantAcl(e: React.FormEvent) {
    e.preventDefault();
    if (!aclForm.accountId || aclForm.actions.length === 0) return;
    setSaving(true);
    fetch(`/api/v1/resources/${resource.id}/acl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: aclForm.accountId, actions: aclForm.actions }),
    })
      .then((r) => r.json())
      .then((entry: AclEntry) => {
        const acc = accounts.find((a) => a.id === aclForm.accountId);
        setAcl((prev) => [{ ...entry, granteeUsername: acc?.username ?? null, grantedBy: null, grantedAt: new Date().toISOString() }, ...prev]);
        setShowAclForm(false);
        setAclForm({ accountId: '', actions: ['read'] });
      })
      .finally(() => setSaving(false));
  }

  function handleRevokeAcl(aclId: string) {
    fetch(`/api/v1/resources/${resource.id}/acl/${aclId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => setAcl((prev) => prev.map((a) => a.id === aclId ? { ...a, status: 'REVOKED' } : a)));
  }

  return (
    <div className="border-t border-border bg-bg-primary">
      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {(['acl', 'events'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              tab === t ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}>
            {t === 'acl' ? 'Access Control' : 'Access History'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'acl' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Who can access this resource and what they can do</span>
              <button onClick={() => setShowAclForm((v) => !v)}
                className="flex items-center gap-1.5 text-xs bg-accent-blue hover:bg-accent-blue-hover text-white px-3 py-1.5 rounded transition-colors">
                <Plus className="w-3 h-3" /> Grant Access
              </button>
            </div>

            {showAclForm && (
              <form onSubmit={handleGrantAcl} className="bg-bg-secondary border border-border rounded p-3 flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <select value={aclForm.accountId} onChange={(e) => setAclForm((f) => ({ ...f, accountId: e.target.value }))}
                    className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none" required>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
                  </select>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ALL_ACTIONS.map((a) => (
                      <label key={a} className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                        <input type="checkbox" checked={aclForm.actions.includes(a)} onChange={() => toggleAction(a)}
                          className="accent-accent-blue" />
                        {a}
                      </label>
                    ))}
                  </div>
                  <button type="submit" disabled={saving || !aclForm.accountId || aclForm.actions.length === 0}
                    className="bg-accent-blue hover:bg-accent-blue-hover text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">
                    {saving ? 'Saving…' : 'Grant'}
                  </button>
                </div>
              </form>
            )}

            {loadingAcl ? (
              <div className="flex flex-col gap-2 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-10 bg-bg-tertiary rounded" />)}
              </div>
            ) : acl.length === 0 ? (
              <div className="text-xs text-text-muted py-4 text-center">No ACL entries — only the owner has access</div>
            ) : (
              <div className="flex flex-col gap-1">
                {acl.map((entry) => (
                  <div key={entry.id} className={`flex items-center justify-between px-3 py-2 rounded border ${
                    entry.status === 'REVOKED' ? 'border-border opacity-40' : 'border-border bg-bg-secondary'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-text-primary">{entry.granteeUsername ?? entry.granteeId}</span>
                      <div className="flex items-center gap-1">
                        {entry.permittedActions.map((a) => (
                          <span key={a} className="text-[11px] bg-accent-blue-subtle text-accent-blue px-1.5 py-0.5 rounded font-mono">{a}</span>
                        ))}
                      </div>
                      {entry.status === 'REVOKED' && (
                        <span className="text-[11px] text-critical-text">REVOKED</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted">{timeAgo(entry.grantedAt)}</span>
                      {entry.status === 'ACTIVE' && (
                        <button onClick={() => handleRevokeAcl(entry.id)}
                          className="text-text-muted hover:text-critical-text transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'events' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-secondary">Last 30 access events for this resource</span>
            {loadingEvents ? (
              <div className="flex flex-col gap-1.5 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-9 bg-bg-tertiary rounded" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="text-xs text-text-muted py-4 text-center">No access events recorded yet</div>
            ) : (
              <div className="flex flex-col gap-1">
                {events.map((ev) => {
                  const detail = ev.detail as Record<string, unknown>;
                  const hash = typeof detail['currentHash'] === 'string' ? detail['currentHash'] as string : null;
                  const baselineHash = typeof detail['baselineHash'] === 'string' ? detail['baselineHash'] as string : null;
                  const hashMismatch = detail['hashMismatch'] === true;
                  const aclViolation = detail['aclViolation'] === true;

                  return (
                    <div key={ev.id} className={`flex items-start justify-between px-3 py-2 rounded border ${
                      ev.outcome === 'DENIED' ? 'border-critical-border bg-critical-bg/30' :
                      ev.outcome === 'FLAGGED' ? 'border-high-border bg-high-bg/30' :
                      'border-border bg-bg-secondary'
                    }`}>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${OUTCOME_STYLES[ev.outcome] ?? 'text-text-secondary'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${OUTCOME_DOT[ev.outcome] ?? 'bg-text-muted'}`} />
                            {ev.outcome}
                          </span>
                          <span className="font-mono text-xs text-text-secondary">{ev.eventType}</span>
                          <span className="font-mono text-xs text-text-primary">{ev.actorUsername ?? ev.actorId ?? 'unknown'}</span>
                          {ev.sourceIp && <span className="font-mono text-xs text-text-muted">{ev.sourceIp}</span>}
                        </div>
                        {(aclViolation || hashMismatch) && (
                          <div className="flex items-center gap-2 text-[11px]">
                            {aclViolation && (
                              <span className="flex items-center gap-1 text-critical-text">
                                <ShieldX className="w-3 h-3" /> ACL violation
                              </span>
                            )}
                            {hashMismatch && (
                              <span className="flex items-center gap-1 text-high-text">
                                <Hash className="w-3 h-3" />
                                Hash mismatch — baseline: <span className="font-mono">{baselineHash?.slice(0, 8)}…</span>
                                → now: <span className="font-mono">{hash?.slice(0, 8)}…</span>
                              </span>
                            )}
                          </div>
                        )}
                        {hash && !hashMismatch && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-green-text" />
                            <span className="font-mono">sha256:{hash.slice(0, 16)}…</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-muted font-mono whitespace-nowrap ml-4 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo(ev.occurredAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Resources() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [resources, setResources]   = useState<Resource[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [form, setForm]             = useState({ name: '', path: '', type: 'FILE' });
  const [submitting, setSubmitting] = useState(false);

  const fetchResources = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/resources', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: Resource[]) => { setResources(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchResources();
    // Also fetch accounts for ACL grant form
    if (token) {
      fetch('/api/v1/accounts', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data: Account[]) => setAccounts(data))
        .catch(() => undefined);
    }
  }, [fetchResources, token]);

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name) return;
    setSubmitting(true);
    fetch('/api/v1/resources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then((created: Resource) => {
        setResources((prev) => [{ ...created, aclCount: 0, ownerUsername: null }, ...prev]);
        setShowForm(false);
        setForm({ name: '', path: '', type: 'FILE' });
      })
      .finally(() => setSubmitting(false));
  }

  const filtered = resources.filter((r) =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.path ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.ownerUsername ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Resource Registry</h1>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-2 rounded text-sm font-medium transition-colors">
          {showForm ? 'Cancel' : '+ Register Resource'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleRegister} className="bg-bg-secondary border border-border rounded-md p-4 flex flex-col gap-3">
          <span className="text-sm font-semibold text-text-primary">Register Resource</span>
          <div className="flex items-center gap-3 flex-wrap">
            <input required placeholder="Name *" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-48" />
            <input placeholder="Full path (e.g. C:\data\xyz.txt)" value={form.path}
              onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
              className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-72 font-mono" />
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none">
              {Object.keys(TYPE_ICON).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="submit" disabled={submitting}
              className="bg-accent-blue hover:bg-accent-blue-hover text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50">
              {submitting ? 'Saving…' : 'Register'}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            The path must exactly match what the file watcher reports (e.g. <span className="font-mono">C:\Users\ASUS\Documents\xyz.txt</span>).
            The first write event will set the baseline hash automatically.
          </p>
        </form>
      )}

      <input type="text" placeholder="Search resources…" value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none w-64" />

      <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider w-6" />
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name / Path</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Owner</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Integrity</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">ACL</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                  {search ? 'No resources match your search' : 'No resources registered yet'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <>
                  <tr key={r.id}
                    onClick={() => setExpanded((v) => v === r.id ? null : r.id)}
                    className={`border-b border-border hover:bg-bg-hover transition-colors cursor-pointer ${
                      r.currentFlag === 'CRITICAL' ? 'bg-critical-bg/20' : ''
                    }`}>
                    <td className="px-4 py-3 text-text-muted">
                      {expanded === r.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <span className="mr-2">{TYPE_ICON[r.type] ?? '📄'}</span>
                      {r.name}
                      {r.path && <span className="ml-2 text-xs text-text-muted font-mono">{r.path}</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.type}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{r.ownerUsername ?? '—'}</td>
                    <td className={`px-4 py-3 font-medium text-xs ${STATUS_STYLES[r.status] ?? 'text-text-secondary'}`}>{r.status}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/resources/${r.id}/events`); }}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded transition-colors hover:opacity-80 ${FLAG_TEXT[r.currentFlag] ?? 'text-text-secondary'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${FLAG_DOT[r.currentFlag] ?? 'bg-text-muted'} ${r.currentFlag !== 'CLEAN' ? 'animate-pulse' : ''}`} />
                        {r.currentFlag ?? 'CLEAN'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.aclCount} {r.aclCount === 1 ? 'entry' : 'entries'}</td>
                  </tr>
                  {expanded === r.id && token && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={7} className="p-0">
                        <ResourceDetail resource={r} token={token} accounts={accounts} />
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border text-sm text-text-secondary">
          {loading ? 'Loading…' : `${filtered.length} of ${resources.length} resources`}
        </div>
      </div>
    </div>
  );
}
