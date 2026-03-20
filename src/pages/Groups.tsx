import { useState, useEffect, useCallback } from 'react';
import { UsersRound, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
}

interface Member {
  accountId: string;
  username: string;
  email: string | null;
  role: string;
  status: string;
  addedAt: string;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-bg-tertiary rounded w-24" />
        </td>
      ))}
    </tr>
  );
}

export default function Groups() {
  const token = useAuthStore((s) => s.token);
  const [groups, setGroups]         = useState<Group[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [members, setMembers]       = useState<Record<string, Member[]>>({});
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ name: '', description: '' });
  const [saving, setSaving]         = useState(false);
  const [addAccountId, setAddAccountId] = useState<Record<string, string>>({});

  const fetchGroups = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/v1/groups', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: Group[]) => { setGroups(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (members[id]) return;
    const res = await fetch(`/api/v1/groups/${id}/members`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    const data = await res.json() as Member[];
    setMembers((prev) => ({ ...prev, [id]: data }));
  }

  async function createGroup() {
    if (!token || !form.name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/groups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const created = await res.json() as Group;
      setGroups((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', description: '' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!token) return;
    await fetch(`/api/v1/groups/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function addMember(groupId: string) {
    const accountId = addAccountId[groupId]?.trim();
    if (!token || !accountId) return;
    const res = await fetch(`/api/v1/groups/${groupId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    if (!res.ok) return;
    const added = await res.json() as { accountId: string; username: string };
    setMembers((prev) => ({
      ...prev,
      [groupId]: [...(prev[groupId] ?? []), {
        accountId: added.accountId, username: added.username,
        email: null, role: '', status: '', addedAt: new Date().toISOString(),
      }],
    }));
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, memberCount: g.memberCount + 1 } : g));
    setAddAccountId((prev) => ({ ...prev, [groupId]: '' }));
  }

  async function removeMember(groupId: string, accountId: string) {
    if (!token) return;
    await fetch(`/api/v1/groups/${groupId}/members/${accountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMembers((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).filter((m) => m.accountId !== accountId),
    }));
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="w-5 h-5 text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Groups &amp; Privileges</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-accent-blue text-white px-3 py-2 rounded text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Group
        </button>
      </div>

      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-md p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-text-primary">Create Group</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Group name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none"
            />
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-bg-tertiary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createGroup}
              disabled={saving || !form.name}
              className="bg-accent-blue text-white px-4 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-bg-secondary border border-border rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-tertiary">
              {['Group', 'Description', 'Members', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonRow key={i} />)
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-text-muted">No groups created</td>
              </tr>
            ) : (
              groups.map((g) => (
                <>
                  <tr
                    key={g.id}
                    className="border-b border-border hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => toggleExpand(g.id)}
                  >
                    <td className="px-4 py-3 text-text-primary font-medium flex items-center gap-2">
                      {expanded === g.id
                        ? <ChevronDown className="w-4 h-4 text-text-muted" />
                        : <ChevronRight className="w-4 h-4 text-text-muted" />}
                      {g.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{g.description ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{g.memberCount}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => deleteGroup(g.id)}
                        className="text-text-muted hover:text-critical-text transition-colors"
                        aria-label="Delete group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expanded === g.id && (
                    <tr key={`${g.id}-members`} className="border-b border-border bg-bg-primary">
                      <td colSpan={4} className="px-8 py-4">
                        <div className="flex flex-col gap-3">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Members</p>
                          {(members[g.id] ?? []).length === 0 ? (
                            <p className="text-sm text-text-muted">No members yet</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {(members[g.id] ?? []).map((m) => (
                                <div key={m.accountId} className="flex items-center justify-between text-sm">
                                  <span className="font-mono text-text-primary">{m.username}</span>
                                  <button
                                    onClick={() => removeMember(g.id, m.accountId)}
                                    className="text-xs text-text-muted hover:text-critical-text"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              placeholder="Account ID to add"
                              value={addAccountId[g.id] ?? ''}
                              onChange={(e) => setAddAccountId((prev) => ({ ...prev, [g.id]: e.target.value }))}
                              className="bg-bg-tertiary border border-border rounded px-3 py-1 text-xs text-text-primary font-mono focus:border-accent-blue outline-none w-64"
                            />
                            <button
                              onClick={() => addMember(g.id)}
                              className="text-xs bg-accent-blue text-white px-3 py-1 rounded hover:opacity-90"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border text-sm text-text-secondary">
          {loading ? 'Loading…' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}
