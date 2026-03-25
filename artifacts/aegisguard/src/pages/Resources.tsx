import React, { useState } from "react";
import { useResources } from "@/hooks/use-resources";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui-elements";
import { Database, Plus, Archive, Lock, Unlock, ShieldAlert, FileCode2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const typeIcons: Record<string, any> = {
  file: FileCode2,
  directory: Database,
  database: Database,
  api: Lock,
  other: ShieldAlert,
};

function AclPanel({ resourceId }: { resourceId: number }) {
  const { getAcl, grantAcl, revokeAcl } = useResources();
  const acl = getAcl(resourceId);
  const [addOpen, setAddOpen] = useState(false);
  const entries: any[] = acl.data ?? [];

  const handleGrant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actions = (fd.get("actions") as string).split(",").map(s => s.trim()).filter(Boolean);
    await grantAcl.mutateAsync({ resourceId, data: { subject: fd.get("subject"), subjectType: fd.get("subjectType"), permittedActions: actions } });
    setAddOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Access Control List</h4>
      {entries.length === 0 && <p className="text-xs text-muted-foreground">No ACL entries.</p>}
      {entries.map(entry => (
        <div key={entry.id} className={`flex items-center justify-between p-3 rounded-lg border ${entry.status === "revoked" ? "opacity-50 border-border/30" : "border-border/50 bg-secondary/20"}`}>
          <div>
            <span className="font-mono text-sm text-foreground">{entry.subject}</span>
            <Badge variant="outline" className="ml-2 text-xs">{entry.subjectType}</Badge>
            <div className="flex flex-wrap gap-1 mt-1">
              {(entry.permittedActions as string[]).map(a => (
                <span key={a} className="bg-primary/10 text-primary text-[10px] font-mono px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant={entry.status === "active" ? "success" : "outline"}>{entry.status}</Badge>
            {entry.status === "active" && (
              <Button size="sm" variant="ghost" onClick={() => revokeAcl.mutate({ resourceId, entryId: entry.id })}>
                <Unlock className="w-4 h-4 text-warning" />
              </Button>
            )}
          </div>
        </div>
      ))}
      {addOpen ? (
        <form onSubmit={handleGrant} className="p-3 border border-border/50 rounded-lg bg-secondary/10 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Subject (user or group)</label>
              <input name="subject" required className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1.5 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <select name="subjectType" defaultValue="user" className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1.5 text-sm text-foreground">
                <option value="user">User</option>
                <option value="group">Group</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Actions (comma-separated, e.g. read, write, delete)</label>
            <input name="actions" required defaultValue="read" className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1.5 text-sm font-mono text-foreground" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={grantAcl.isPending}>Grant</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Lock className="w-4 h-4 mr-2" /> Grant Access
        </Button>
      )}
    </div>
  );
}

export default function Resources() {
  const { list, create, update, remove } = useResources();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const resources: any[] = list.data ?? [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      name: fd.get("name"),
      type: fd.get("type"),
      path: fd.get("path"),
      description: fd.get("description") || undefined,
      baselineHash: fd.get("baselineHash") || undefined,
    });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Resource Registry</h1>
          <p className="text-muted-foreground mt-1">Files, directories, databases, APIs — with ACL and hash integrity</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register Resource
        </Button>
      </div>

      <div className="space-y-3">
        {list.isLoading && (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {!list.isLoading && resources.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No resources registered yet</p>
          </CardContent></Card>
        )}
        {resources.map(r => {
          const Icon = typeIcons[r.type] || Database;
          const hashMismatch = r.baselineHash && r.currentHash && r.baselineHash !== r.currentHash;
          const isExpanded = expanded === r.id;
          return (
            <Card key={r.id} className={hashMismatch ? "border-warning/40" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${hashMismatch ? "bg-warning/10 border-warning/30" : "bg-primary/10 border-primary/20"}`}>
                    <Icon className={`w-5 h-5 ${hashMismatch ? "text-warning" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{r.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                      {hashMismatch && <Badge variant="warning">Hash Mismatch</Badge>}
                    </div>
                    <p className="font-mono text-xs text-primary mt-0.5 truncate">{r.path}</p>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                    {r.baselineHash && (
                      <div className="mt-2 space-y-1 text-xs font-mono">
                        <div className="flex gap-2"><span className="text-muted-foreground w-28 flex-shrink-0">Baseline:</span><span className="text-foreground truncate">{r.baselineHash}</span></div>
                        {r.currentHash && <div className="flex gap-2"><span className="text-muted-foreground w-28 flex-shrink-0">Current:</span><span className={`truncate ${hashMismatch ? "text-warning" : "text-success"}`}>{r.currentHash}</span></div>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                      {isExpanded ? "Hide ACL" : "ACL"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, data: { archived: !r.archived } })} title={r.archived ? "Unarchive" : "Archive"}>
                      <Archive className={`w-4 h-4 ${r.archived ? "text-success" : "text-muted-foreground"}`} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete resource "${r.name}"?`)) remove.mutate(r.id); }}>
                      <ShieldAlert className="w-4 h-4 text-destructive/60" />
                    </Button>
                  </div>
                </div>
                {isExpanded && <AclPanel resourceId={r.id} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">Register Resource</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Name</label>
                  <input name="name" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Type</label>
                  <select name="type" defaultValue="file" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                    {["file", "directory", "database", "api", "other"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Path / Endpoint</label>
                <input name="path" required placeholder="/var/data/config.db" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Description</label>
                <input name="description" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Baseline Hash (SHA-256, optional)</label>
                <input name="baselineHash" placeholder="e3b0c44298fc..." className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Register</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
