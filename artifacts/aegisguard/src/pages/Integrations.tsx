import React, { useState } from "react";
import { useIntegrations } from "@/hooks/use-integrations";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui-elements";
import { Plug, Plus, Trash2, RefreshCw, Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusColors: Record<string, any> = {
  ACTIVE: "success",
  DEGRADED: "warning",
  SILENT: "outline",
  DISCONNECTED: "destructive",
};

const statusDot: Record<string, string> = {
  ACTIVE: "bg-success",
  DEGRADED: "bg-warning",
  SILENT: "bg-muted-foreground",
  DISCONNECTED: "bg-destructive",
};

export default function Integrations() {
  const { list, create, heartbeat, remove } = useIntegrations();
  const [createOpen, setCreateOpen] = useState(false);
  const integrations: any[] = list.data ?? [];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      name: fd.get("name"),
      type: fd.get("type"),
      method: fd.get("method"),
      version: fd.get("version") || undefined,
      endpoint: fd.get("endpoint") || undefined,
      status: "DISCONNECTED",
    });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleHeartbeat = async (id: number) => {
    await heartbeat.mutateAsync({ id, status: "ACTIVE" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Integration Health</h1>
          <p className="text-muted-foreground mt-1">
            {integrations.filter(i => i.status === "ACTIVE").length} of {integrations.length} integrations active · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => list.refetch()}>
            <RefreshCw className={`w-4 h-4 mr-2 ${list.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Integration
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["ACTIVE", "DEGRADED", "SILENT", "DISCONNECTED"] as const).map(s => {
          const count = integrations.filter(i => i.status === s).length;
          return (
            <Card key={s}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${statusDot[s]} ${s === "ACTIVE" ? "animate-pulse" : ""}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{s}</p>
                  <p className="text-2xl font-display font-bold text-foreground">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.isLoading && (
          <div className="col-span-full flex justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {!list.isLoading && integrations.length === 0 && (
          <div className="col-span-full">
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Plug className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No integrations registered</p>
            </CardContent></Card>
          </div>
        )}
        {integrations.map(integ => (
          <Card key={integ.id} className={`border-l-4 ${integ.status === "ACTIVE" ? "border-l-success" : integ.status === "DEGRADED" ? "border-l-warning" : integ.status === "DISCONNECTED" ? "border-l-destructive" : "border-l-border"}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDot[integ.status]} ${integ.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                    <h3 className="font-semibold text-foreground">{integ.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integ.type} · {integ.method}</p>
                </div>
                <Badge variant={statusColors[integ.status]}>{integ.status}</Badge>
              </div>
              {integ.endpoint && (
                <p className="text-xs font-mono text-muted-foreground truncate mb-2">{integ.endpoint}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground font-mono">
                  Last seen: {integ.lastSeen ? formatDate(integ.lastSeen) : "Never"}
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" title="Send heartbeat" onClick={() => handleHeartbeat(integ.id)}>
                    <Activity className="w-4 h-4 text-success" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove integration "${integ.name}"?`)) remove.mutate(integ.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive/70" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">Add Integration</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Name</label>
                <input name="name" required placeholder="Splunk SIEM" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Type</label>
                  <select name="type" defaultValue="siem" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                    {["siem", "edr", "syslog", "webhook", "kafka", "custom"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Method</label>
                  <select name="method" defaultValue="push" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                    <option value="push">Push</option>
                    <option value="pull">Pull</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Version</label>
                  <input name="version" placeholder="v2.0" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Endpoint</label>
                  <input name="endpoint" placeholder="https://siem.corp/api" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Add Integration</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
