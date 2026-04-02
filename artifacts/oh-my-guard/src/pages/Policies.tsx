import React, { useState } from "react";
import { usePolicies } from "@/hooks/use-policies";
import { Card, CardContent, Button, Modal, Input, Badge } from "@/components/ui-elements";
import { Plus, Trash2, CheckSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Policies() {
  const { list, create, remove } = usePolicies();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      data: {
        resourcePath: fd.get("resourcePath") as string,
        groupName: fd.get("groupName") as string,
        permissions: {
          view: fd.get("view") === "on",
          edit: fd.get("edit") === "on",
          delete: fd.get("delete") === "on",
          rename: fd.get("rename") === "on",
          fullControl: fd.get("fullControl") === "on",
        }
      }
    });
    setIsCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Access Control Policies</h1>
          <p className="text-muted-foreground mt-1">Manage RBAC and resource permissions</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {(Array.isArray(list.data) ? list.data : []).map(policy => (
          <Card key={policy.id} className="relative group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <Badge variant="outline" className="font-mono text-[10px]">{policy.groupName || `User ID: ${policy.userId}`}</Badge>
                <Button variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate({ id: policy.id })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="text-lg font-mono text-primary mb-4 break-all">{policy.resourcePath}</h3>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Permissions</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(policy.permissions).map(([key, value]) => value && (
                    <Badge key={key} variant="success" className="bg-success/10 text-success border-success/20 gap-1 pl-1">
                      <CheckSquare className="w-3 h-3" /> {key}
                    </Badge>
                  ))}
                  {!Object.values(policy.permissions).some(Boolean) && (
                    <span className="text-xs text-muted-foreground italic">No permissions granted</span>
                  )}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-border/50 text-[10px] text-muted-foreground text-right">
                Created: {formatDate(policy.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
        {Array.isArray(list.data) && list.data.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No access policies defined.</div>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Access Policy">
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Resource Path</label>
            <Input name="resourcePath" required placeholder="/var/www/html or /etc/passwd" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Target Group</label>
            <Input name="groupName" required placeholder="sysadmins" />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-3 block text-muted-foreground">Permissions</label>
            <div className="grid grid-cols-2 gap-3 p-4 bg-secondary/20 rounded-xl border border-border/50">
              {['view', 'edit', 'delete', 'rename', 'fullControl'].map(perm => (
                <label key={perm} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" name={perm} className="rounded border-border bg-background text-primary focus:ring-primary/50" />
                  <span className="capitalize">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={create.isPending}>Save Policy</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
