import React, { useState } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui-elements";
import { Users, Plus, ShieldCheck, ShieldOff, UserX, Key, Edit2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, any> = {
  active: "success",
  suspended: "warning",
  revoked: "destructive",
};

const ROLES = ["super_admin", "admin", "analyst", "viewer"];

export default function Accounts() {
  const { list, create, update, suspend, reactivate, revoke } = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const accounts: any[] = list.data ?? [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      username: fd.get("username"),
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"),
    });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await update.mutateAsync({ id: editTarget.id, data: { email: fd.get("email"), role: fd.get("role") } });
    setEditTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Account Management</h1>
          <p className="text-muted-foreground mt-1">{accounts.length} registered operator accounts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Account
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Username</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">MFA</th>
                  <th className="px-6 py-4 font-medium">Failed Logins</th>
                  <th className="px-6 py-4 font-medium">Last Login</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {list.isLoading && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    <div className="flex justify-center"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>
                  </td></tr>
                )}
                {!list.isLoading && accounts.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No accounts yet</p>
                  </td></tr>
                )}
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {acc.username[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground font-mono">{acc.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{acc.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="font-mono text-xs">{acc.role}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant[acc.status]}>{acc.status}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={acc.mfaEnabled ? "success" : "outline"}>
                        <Key className="w-3 h-3 mr-1" />{acc.mfaEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <span className={acc.failedLoginCount > 0 ? "text-warning" : "text-muted-foreground"}>
                        {acc.failedLoginCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                      {acc.lastLogin ? formatDate(acc.lastLogin) : "Never"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditTarget(acc)} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {acc.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => suspend.mutate(acc.id)} title="Suspend">
                            <ShieldOff className="w-4 h-4 text-warning" />
                          </Button>
                        )}
                        {acc.status === "suspended" && (
                          <Button size="sm" variant="ghost" onClick={() => reactivate.mutate(acc.id)} title="Reactivate">
                            <ShieldCheck className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        {acc.status !== "revoked" && (
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Permanently revoke ${acc.username}?`)) revoke.mutate(acc.id); }} title="Revoke">
                            <UserX className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Account Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">Create Account</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Username</label>
                  <input name="username" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Role</label>
                  <select name="role" defaultValue="analyst" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
                <input name="email" type="email" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Password</label>
                <input name="password" type="password" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Create Account</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">Edit — {editTarget.username}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
                <input name="email" type="email" defaultValue={editTarget.email} required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Role</label>
                <select name="role" defaultValue={editTarget.role} className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" isLoading={update.isPending}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
