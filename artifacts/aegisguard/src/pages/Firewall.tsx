import React, { useState } from "react";
import { useFirewall } from "@/hooks/use-firewall";
import { Card, CardContent, Badge, Button, Modal, Input, Select } from "@/components/ui-elements";
import { Plus, ShieldAlert, Check, X, MoveUp, MoveDown, Trash2 } from "lucide-react";
import { CreateFirewallRuleInputAction, CreateFirewallRuleInputProtocol, CreateFirewallRuleInputDirection } from "@workspace/api-client-react";

export default function Firewall() {
  const { list, create, update, remove } = useFirewall();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      data: {
        action: fd.get("action") as CreateFirewallRuleInputAction,
        direction: fd.get("direction") as CreateFirewallRuleInputDirection,
        protocol: fd.get("protocol") as CreateFirewallRuleInputProtocol,
        sourceIp: fd.get("sourceIp") as string || undefined,
        destIp: fd.get("destIp") as string || undefined,
        sourcePort: fd.get("sourcePort") ? parseInt(fd.get("sourcePort") as string) : undefined,
        destPort: fd.get("destPort") ? parseInt(fd.get("destPort") as string) : undefined,
        priority: parseInt(fd.get("priority") as string),
        description: fd.get("description") as string,
      }
    });
    setIsCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Firewall Rules</h1>
          <p className="text-muted-foreground mt-1">Manage layer 3/4 network access controls</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Rule
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium w-16">Pri</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Protocol</th>
                  <th className="px-6 py-4 font-medium">Source</th>
                  <th className="px-6 py-4 font-medium">Destination</th>
                  <th className="px-6 py-4 font-medium">Direction</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono text-[13px]">
                {list.data?.sort((a,b) => a.priority - b.priority).map((rule) => (
                  <tr key={rule.id} className={`hover:bg-secondary/20 transition-colors ${!rule.enabled ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-bold text-muted-foreground">{rule.priority}</td>
                    <td className="px-6 py-4">
                      <Badge variant={rule.action === 'allow' ? 'success' : 'destructive'} className="font-sans">
                        {rule.action.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-primary">{rule.protocol.toUpperCase()}</td>
                    <td className="px-6 py-4">{rule.sourceIp || 'ANY'}{rule.sourcePort ? `:${rule.sourcePort}` : ''}</td>
                    <td className="px-6 py-4">{rule.destIp || 'ANY'}{rule.destPort ? `:${rule.destPort}` : ''}</td>
                    <td className="px-6 py-4 text-muted-foreground font-sans text-xs uppercase">{rule.direction}</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => update.mutate({ id: rule.id, data: { enabled: !rule.enabled } })}
                        className={`inline-flex p-1 rounded-md transition-colors ${rule.enabled ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        {rule.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={() => remove.mutate({ id: rule.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {list.data?.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground font-sans">No firewall rules defined.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Firewall Rule">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Action</label>
              <Select name="action" required>
                <option value="allow">ALLOW</option>
                <option value="deny">DENY</option>
                <option value="drop">DROP</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Protocol</label>
              <Select name="protocol" required>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
                <option value="any">ANY</option>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/50 bg-secondary/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Source</h4>
              <Input name="sourceIp" placeholder="IP (leave blank for ANY)" />
              <Input name="sourcePort" type="number" placeholder="Port" />
            </div>
            <div className="p-4 rounded-xl border border-border/50 bg-secondary/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Destination</h4>
              <Input name="destIp" placeholder="IP (leave blank for ANY)" />
              <Input name="destPort" type="number" placeholder="Port" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Direction</label>
              <Select name="direction" required>
                <option value="inbound">INBOUND</option>
                <option value="outbound">OUTBOUND</option>
                <option value="both">BOTH</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Priority (lower is higher)</label>
              <Input name="priority" type="number" required defaultValue="100" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Description</label>
            <Input name="description" placeholder="Allow internal HTTPS traffic..." />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={create.isPending}>Add Rule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
