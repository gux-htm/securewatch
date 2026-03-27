import React, { useState } from "react";
import { useGroups } from "@/hooks/use-groups";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui-elements";
import { Users2, Plus, Trash2, ChevronDown, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

function GroupRow({ group, accounts, addMember, removeMember }: any) {
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");

  const members = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${group.id}/members`);
      return res.json();
    },
    enabled: expanded,
  });

  const handleAdd = async () => {
    if (!selectedAccountId) return;
    const acc = accounts.find((a: any) => a.id === Number(selectedAccountId));
    if (!acc) return;
    await addMember.mutateAsync({ groupId: group.id, accountId: acc.id, username: acc.username });
    setAddOpen(false);
    setSelectedAccountId("");
  };

  const memberIds = (members.data ?? []).map((m: any) => m.accountId);
  const available = (accounts ?? []).filter((a: any) => !memberIds.includes(a.id) && a.status === "active");

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Users2 className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <span className="font-medium text-foreground">{group.name}</span>
          {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
        </div>
        <Badge variant="outline">{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</Badge>
        <span className="text-xs font-mono text-muted-foreground">{formatDate(group.createdAt)}</span>
      </div>

      {expanded && (
        <div className="px-5 py-4 bg-secondary/10 space-y-3">
          {members.isLoading && <div className="text-sm text-muted-foreground">Loading members…</div>}
          {(members.data ?? []).length === 0 && !members.isLoading && (
            <div className="text-sm text-muted-foreground">No members yet.</div>
          )}
          {(members.data ?? []).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {m.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground font-mono">{m.username}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeMember.mutate({ groupId: group.id, memberId: m.id })}>
                <UserMinus className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}

          {addOpen ? (
            <div className="flex items-center gap-2 pt-2">
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(Number(e.target.value))}
                className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                <option value="">Select account…</option>
                {available.map((a: any) => <option key={a.id} value={a.id}>{a.username}</option>)}
              </select>
              <Button size="sm" onClick={handleAdd} isLoading={addMember.isPending} disabled={!selectedAccountId}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Member
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Groups() {
  const { list, create, remove, addMember, removeMember } = useGroups();
  const { list: accountList } = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const groups: any[] = list.data ?? [];
  const accounts: any[] = accountList.data ?? [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({ name: fd.get("name") as string, description: fd.get("description") as string });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Groups &amp; Privileges</h1>
          <p className="text-muted-foreground mt-1">{groups.length} privilege groups</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Group
        </Button>
      </div>

      <div className="space-y-3">
        {list.isLoading && (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {!list.isLoading && groups.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No groups created yet</p>
          </CardContent></Card>
        )}
        {groups.map((g) => (
          <div key={g.id} className="relative">
            <GroupRow group={g} accounts={accounts} addMember={addMember} removeMember={removeMember} />
            <Button size="sm" variant="ghost"
              className="absolute top-3 right-16"
              onClick={() => { if (confirm(`Delete group "${g.name}"?`)) remove.mutate(g.id); }}>
              <Trash2 className="w-4 h-4 text-destructive/60" />
            </Button>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">New Group</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Group Name</label>
                <input name="name" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Description</label>
                <input name="description" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Create Group</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
