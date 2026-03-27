import React, { useState } from "react";
import { useAlerts } from "@/hooks/use-alerts";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui-elements";
import { BellRing, CheckCheck, Filter, Trash2, Plus, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

const severityColors: Record<string, string> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "outline",
  LOW: "outline",
  INFO: "secondary",
};

const severityBorder: Record<string, string> = {
  CRITICAL: "border-l-destructive",
  HIGH: "border-l-warning",
  MEDIUM: "border-l-primary",
  LOW: "border-l-muted-foreground",
  INFO: "border-l-muted-foreground",
};

export default function Alerts() {
  const [severity, setSeverity] = useState<string | undefined>();
  const [showAcked, setShowAcked] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const { list, acknowledge, bulkAcknowledge, create, remove } = useAlerts(
    severity ? { severity, acknowledged: showAcked ? undefined : false } : { acknowledged: showAcked ? undefined : false }
  );
  const [createOpen, setCreateOpen] = useState(false);

  const alerts: any[] = list.data ?? [];
  const unack = alerts.filter((a) => !a.acknowledged).length;

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleBulkAck = async () => {
    if (selected.length === 0) return;
    await bulkAcknowledge.mutateAsync({ ids: selected });
    setSelected([]);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await create.mutateAsync({
      title: fd.get("title"),
      message: fd.get("message"),
      severity: fd.get("severity"),
      source: fd.get("source") || "manual",
    });
    setCreateOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Alert Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Unified security alerts — {unack} unacknowledged
          </p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="outline" onClick={handleBulkAck} isLoading={bulkAcknowledge.isPending}>
              <CheckCheck className="w-4 h-4 mr-2" /> Ack {selected.length}
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Alert
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <button
            onClick={() => setSeverity(undefined)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!severity ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}
          >All</button>
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setSeverity(s === severity ? undefined : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${severity === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}>
              {s}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)} className="accent-primary" />
              Show acknowledged
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Alerts list */}
      <Card>
        <CardContent className="p-0 divide-y divide-border/50">
          {list.isLoading && (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
          {!list.isLoading && alerts.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <BellRing className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No alerts match the current filter</p>
            </div>
          )}
          {alerts.map((alert) => (
            <div key={alert.id}
              className={`flex items-start gap-4 px-6 py-4 border-l-4 ${severityBorder[alert.severity] || "border-l-border"} ${alert.acknowledged ? "opacity-50" : ""} hover:bg-secondary/10 transition-colors`}>
              <input type="checkbox" checked={selected.includes(alert.id)} onChange={() => toggleSelect(alert.id)}
                className="mt-1 accent-primary" />
              <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.severity === "CRITICAL" ? "text-destructive" : alert.severity === "HIGH" ? "text-warning" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{alert.title}</span>
                  <Badge variant={severityColors[alert.severity] as any}>{alert.severity}</Badge>
                  {alert.acknowledged && <Badge variant="secondary">Acknowledged</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                <div className="flex gap-4 mt-1 text-xs font-mono text-muted-foreground">
                  <span>{formatDate(alert.createdAt)}</span>
                  {alert.source && <span>Source: {alert.source}</span>}
                  {alert.acknowledged && alert.acknowledgedBy && <span>Acked by: {alert.acknowledgedBy}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!alert.acknowledged && (
                  <Button size="sm" variant="ghost" onClick={() => acknowledge.mutate({ id: alert.id })}>
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(alert.id)}>
                  <Trash2 className="w-4 h-4 text-destructive/70" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create Alert Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-display font-bold text-xl text-foreground">New Alert</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Title</label>
                <input name="title" required className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Message</label>
                <textarea name="message" required rows={3} className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Severity</label>
                  <select name="severity" defaultValue="HIGH" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                    {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Source</label>
                  <input name="source" defaultValue="manual" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={create.isPending}>Create Alert</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
