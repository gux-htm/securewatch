import React, { useState } from "react";
import { useNetworks } from "@/hooks/use-networks";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Modal, Input, Select } from "@/components/ui-elements";
import { Network, Plus, Download, Key } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Networks() {
  const { list, create, remove, genOvpn } = useNetworks();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [ovpnResult, setOvpnResult] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      data: {
        name: fd.get("name") as string,
        subnet: fd.get("subnet") as string,
        port: parseInt(fd.get("port") as string),
        protocol: fd.get("protocol") as string,
        description: fd.get("description") as string,
      }
    });
    setIsCreateOpen(false);
  };

  const handleGenerateConfig = async (networkId: number) => {
    try {
      const res = await genOvpn.mutateAsync({ id: networkId, data: { deviceId: 1, commonName: "admin-client" } });
      setOvpnResult(res.config);
    } catch (err) {
      alert("Failed to generate config. (Check if device exists)");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">VPN Networks</h1>
          <p className="text-muted-foreground mt-1">Manage secure tunnels and configurations</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Network
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(Array.isArray(list.data) ? list.data : []).map(net => (
          <Card key={net.id} className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors" />
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/50">
                  <Network className="w-6 h-6 text-primary" />
                </div>
                <Badge variant={net.status === 'active' ? 'success' : 'outline'}>{net.status}</Badge>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">{net.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{net.description || 'No description'}</p>
              
              <div className="space-y-2 mb-6 text-sm font-mono bg-background/50 p-3 rounded-lg border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subnet:</span>
                  <span className="text-primary">{net.subnet}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocol:</span>
                  <span className="text-foreground">{net.protocol.toUpperCase()} / {net.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devices:</span>
                  <span className="text-foreground">{net.deviceCount || 0} Connected</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs" onClick={() => handleGenerateConfig(net.id)}>
                  <Key className="w-4 h-4 mr-2 text-primary" /> Config
                </Button>
                <Button variant="ghost" className="px-3" onClick={() => remove.mutate({ id: net.id })}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {Array.isArray(list.data) && list.data.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No networks configured.</div>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create VPN Network">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Network Name</label>
            <Input name="name" required placeholder="Corporate Internal" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Subnet (CIDR)</label>
            <Input name="subnet" required placeholder="10.8.0.0/24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Port</label>
              <Input name="port" type="number" required defaultValue="1194" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">Protocol</label>
              <Select name="protocol">
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Description</label>
            <Input name="description" placeholder="Main tunnel for employees" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={create.isPending}>Create Network</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!ovpnResult} onClose={() => setOvpnResult(null)} title="OVPN Configuration Generated">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Distribute this configuration file securely to the endpoint device.</p>
          <pre className="bg-background/80 p-4 rounded-xl border border-border/50 text-xs font-mono text-primary overflow-x-auto max-h-[400px]">
            {ovpnResult}
          </pre>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(ovpnResult || '')}>Copy to Clipboard</Button>
            <Button onClick={() => setOvpnResult(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
