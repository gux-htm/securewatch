content = r'''import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, Badge, Button } from "@/components/ui-elements";
import { Shield, ChevronRight, ChevronDown, FileText, ShieldCheck, ShieldAlert, Filter } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileEvent {
  id: number;
  file_path?: string; filePath?: string;
  action: string;
  hash_before?: string | null; hashBefore?: string | null;
  hash_after?: string | null; hashAfter?: string | null;
  mac_address?: string | null; macAddress?: string | null;
  ip_address?: string | null; ipAddress?: string | null;
  device_signature?: string | null;
  device_hostname?: string | null; deviceHostname?: string | null;
  device_mac?: string | null; deviceMac?: string | null;
  device_ip?: string | null; deviceIp?: string | null;
  user_name?: string | null; userName?: string | null;
  severity?: string;
  privileges_used?: string | null; privilegesUsed?: string | null;
  created_at?: string; createdAt?: string;
  device_id?: number | null; deviceId?: number | null;
}

interface VerifyResult { allowed: boolean; reason: string; matchedFields: Record<string, boolean>; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIONS = ["all", "view", "edit", "create", "delete", "rename"] as const;
type ActionFilter = typeof ACTIONS[number];

const ACTION_VARIANT: Record<string, "success" | "warning" | "destructive" | "default" | "outline"> = {
  create: "success", edit: "warning", delete: "destructive", rename: "default", view: "outline",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-muted-foreground", warning: "text-warning", error: "text-destructive", critical: "text-destructive",
};

const fp = (e: FileEvent) => e.file_path ?? e.filePath ?? "(unknown)";
const ts = (e: FileEvent) => e.created_at ?? e.createdAt ?? "";
const mac = (e: FileEvent) => e.mac_address ?? e.macAddress ?? e.device_mac ?? e.deviceMac ?? null;
const ip = (e: FileEvent) => e.ip_address ?? e.ipAddress ?? e.device_ip ?? e.deviceIp ?? null;
const host = (e: FileEvent) => e.device_hostname ?? e.deviceHostname ?? null;
const hb = (e: FileEvent) => e.hash_before ?? e.hashBefore ?? null;
const ha = (e: FileEvent) => e.hash_after ?? e.hashAfter ?? null;
const sig = (e: FileEvent) => e.device_signature ?? null;
const did = (e: FileEvent) => e.device_id ?? e.deviceId ?? null;
const user = (e: FileEvent) => e.user_name ?? e.userName ?? null;

function groupLatest(events: FileEvent[]) {
  const map = new Map<string, FileEvent>();
  for (const e of events) {
    const p = fp(e);
    const existing = map.get(p);
    if (!existing || ts(e) > ts(existing)) map.set(p, e);
  }
  return Array.from(map.entries())
    .map(([path, latest]) => ({ path, latest }))
    .sort((a, b) => ts(b.latest).localeCompare(ts(a.latest)));
}

// ─── Verify button ────────────────────────────────────────────────────────────

function VerifyButton({ event }: { event: FileEvent }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const id = did(event);

  const verify = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No device ID on this event");
      const res = await fetch(`/api/devices/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac: mac(event), ip: ip(event), certFingerprint: sig(event) }),
      });
      return res.json() as Promise<VerifyResult>;
    },
    onSuccess: setResult,
  });

  if (result) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs rounded px-2 py-1", result.allowed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        {result.allowed ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
        <span>{result.allowed ? "Verified" : "Mismatch"}</span>
        <button onClick={() => setResult(null)} className="ml-1 opacity-60 hover:opacity-100 text-[10px]">✕</button>
      </div>
    );
  }

  return (
    <Button variant="outline" className="h-7 px-2 text-[11px]" onClick={() => verify.mutate()} isLoading={verify.isPending}>
      <Shield className="w-3 h-3 mr-1" /> Verify
    </Button>
  );
}

// ─── Single event row in history ─────────────────────────────────────────────

function HistoryEventRow({ event }: { event: FileEvent }) {
  const t = ts(event);
  const m = mac(event);
  const i = ip(event);
  const h = host(event);
  const s = sig(event);
  const before = hb(event);
  const after = ha(event);
  const sev = event.severity ?? "info";
  const u = user(event);

  return (
    <div className="py-3 border-b border-border/30 last:border-0 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={ACTION_VARIANT[event.action] ?? "outline"} className="text-[10px]">{event.action}</Badge>
        <span className={cn("text-[10px] font-semibold uppercase", SEVERITY_COLOR[sev])}>{sev}</span>
        {t && <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(t)}</span>}
      </div>

      {/* Device / user info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        {(h || u) && (
          <div className="flex gap-1 col-span-2">
            <span className="text-muted-foreground">By:</span>
            <span className="font-medium">{u ?? h}</span>
            {u && h && <span className="text-muted-foreground">({h})</span>}
          </div>
        )}
        {m && <div className="flex gap-1"><span className="text-muted-foreground">MAC:</span><span className="font-mono">{m}</span></div>}
        {i && <div className="flex gap-1"><span className="text-muted-foreground">IP:</span><span className="font-mono">{i}</span></div>}
        {event.privileges_used && <div className="flex gap-1"><span className="text-muted-foreground">Priv:</span><span>{event.privileges_used}</span></div>}
      </div>

      {/* Hashes */}
      {(before || after) && (
        <div className="bg-secondary/20 rounded p-2 space-y-0.5">
          {before && <div className="text-[10px] font-mono"><span className="text-muted-foreground">before: </span><span className="text-foreground/70">{before}</span></div>}
          {after  && <div className="text-[10px] font-mono"><span className="text-muted-foreground">after:  </span><span className="text-foreground/70">{after}</span></div>}
        </div>
      )}

      {/* Signature */}
      {s && (
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          sig: <span className="text-foreground/60">{s.slice(0, 24)}…</span>
        </div>
      )}

      <div className="flex justify-end">
        <VerifyButton event={event} />
      </div>
    </div>
  );
}

// ─── Expanded history panel ───────────────────────────────────────────────────

function FileHistory({ filePath }: { filePath: string }) {
  const [filter, setFilter] = useState<ActionFilter>("all");

  const { data, isLoading } = useQuery<FileEvent[]>({
    queryKey: ["file-history", filePath],
    queryFn: () =>
      fetch(`/api/files/events/history?filePath=${encodeURIComponent(filePath)}`)
        .then(r => r.json()),
    staleTime: 10_000,
  });

  const events = Array.isArray(data) ? data : [];
  const filtered = filter === "all" ? events : events.filter(e => e.action === filter);

  return (
    <div className="border-t border-border/30 bg-secondary/10">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/20 flex-wrap">
        <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
        {ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
              filter === a
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {a}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Events */}
      <div className="px-4 pb-2 max-h-[480px] overflow-y-auto">
        {isLoading && (
          <div className="py-6 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary/30 rounded animate-pulse" />)}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No {filter === "all" ? "" : filter} events for this file.</p>
        )}
        {!isLoading && filtered.map(e => <HistoryEventRow key={e.id} event={e} />)}
      </div>
    </div>
  );
}

// ─── File row (collapsed = latest event summary, expanded = full history) ─────

function FileRow({ path, latest }: { path: string; latest: FileEvent }) {
  const [expanded, setExpanded] = useState(false);
  const t = ts(latest);
  const m = mac(latest);
  const h = host(latest);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      {/* Summary row — click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
      >
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-foreground truncate">{path}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant={ACTION_VARIANT[latest.action] ?? "outline"} className="text-[10px]">{latest.action}</Badge>
            {t && <span className="text-[10px] text-muted-foreground">{formatDate(t)}</span>}
            {h && <span className="text-[10px] text-muted-foreground">by {h}</span>}
            {m && <span className="text-[10px] font-mono text-muted-foreground">{m}</span>}
          </div>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Full history with filters */}
      {expanded && <FileHistory filePath={path} />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FileMonitor() {
  const { data, isLoading } = useQuery<FileEvent[]>({
    queryKey: ["file-events-latest"],
    queryFn: () => fetch("/api/files/latest").then(r => r.json()),
    refetchInterval: 15_000,
  });

  const events: FileEvent[] = Array.isArray(data) ? data : [];
  const groups = groupLatest(events);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">File Monitor</h1>
          <p className="text-muted-foreground mt-1">One row per file — most recent event on top. Click to expand full history.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-primary" />
          <span>{groups.length} monitored path{groups.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-secondary/30 rounded-xl animate-pulse" />)}
            </div>
          )}
          {!isLoading && groups.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No file events recorded yet.</p>
              <p className="text-sm mt-1">Events appear here when devices view or edit monitored files.</p>
            </div>
          )}
          {!isLoading && groups.length > 0 && (
            <div className="p-4 space-y-2">
              {groups.map(g => <FileRow key={g.path} path={g.path} latest={g.latest} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
'''

import os
dst = r"artifacts/oh-my-guard/src/pages/FileMonitor.tsx"
with open(dst, "w", encoding="utf-8") as f:
    f.write(content)
print("Written", os.path.getsize(dst), "bytes")
