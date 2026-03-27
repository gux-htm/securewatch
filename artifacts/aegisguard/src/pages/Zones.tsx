import React, { useState } from "react";
import { useZones } from "@/hooks/use-zones";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui-elements";
import { Globe, Plus, Trash2, Network } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Zones() {
  const { list, create, remove } = useZones();
  const [createOpen, setCreateOpen] = useState(false);
  const zones: any[] = list.data ?? [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      name: fd.get("name") as string,
      cidr: fd.get("cidr") as string,
      description: fd.get("description") as string || undefined,
    });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Network Zones</h1>
          <p className="text-muted-foreground mt-1">CIDR-based zones used for three-layer auth verification (Layer 2)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Zone
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.isLoading && (
          <div className="col-span-full flex justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {!list.isLoading && zones.length === 0 && (
          <div className="col-span-full">
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No network zones defined</p>
              <p className="text-xs mt-1">Create CIDR zones to restrict source IPs during authentication.</p>
            </CardContent></Card>
          </div>
        )}
        {zones.map((z) => (
          <Card key={z.id} className="relative group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Network className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{z.name}</h3>
                    <p className="font-mono text-xs text-primary mt-0.5">{z.cidr}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { if (confirm(`Delete zone "${z.name}"?`)) remove.mutate(z.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              {z.description && (
                <p className="text-sm text-muted-foreground mt-3">{z.description}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono mt-3">{formatDate(z.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>IP Verification Test</CardTitle></CardHeader>
        <CardContent>
          <IpChecker />
        </CardContent>
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">Add Network Zone</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Zone Name</label>
                <input name="name" required placeholder="Corporate LAN" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">CIDR Range</label>
                <input name="cidr" required placeholder="10.0.0.0/8" pattern="^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$"
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Description</label>
                <input name="description" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Add Zone</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function IpChecker() {
  const [ip, setIp] = useState("");
  const [result, setResult] = useState<{ allowed: boolean; zone: any } | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!ip) return;
    setLoading(true);
    try {
      const res = await fetch("/api/zones/check-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      setResult(await res.json());
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <p className="text-sm text-muted-foreground">Check whether an IP address falls within a defined zone (simulates Layer 2 auth verification).</p>
      <div className="flex gap-2">
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.42"
          onKeyDown={e => e.key === "Enter" && check()}
          className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
        <Button onClick={check} isLoading={loading}>Check</Button>
      </div>
      {result && (
        <div className={`p-3 rounded-lg border text-sm ${result.allowed ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
          {result.allowed
            ? <>✓ Allowed — matched zone: <strong>{result.zone?.name}</strong> ({result.zone?.cidr})</>
            : "✗ Denied — IP does not match any registered zone"}
        </div>
      )}
    </div>
  );
}
