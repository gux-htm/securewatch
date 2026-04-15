content = r'''import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, Badge, Button } from "@/components/ui-elements";
import { Shield, ChevronRight, ChevronDown, FileText, ShieldCheck, ShieldAlert } from "lucide-react";
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
  severity?: string;
  privileges_used?: string | null; privilegesUsed?: string | null;
  created_at?: string; createdAt?: string;
  device_id?: number | null; deviceId?: number | null;
}

interface VerifyResult { allowed: boolean; reason: string; matchedFields: Record<string, boolean>; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_VARIANT: Record<string, "success" | "warning" | "destructive" | "default" | "outline"> = {
  create: "success", edit: "warning", delete: "destructive", rename: "default", view: "outline",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-muted-foreground", warning: "text-warning", error: "text-destructive", critical: "text-destructive",
};

function path(e: FileEvent) { return e.file_path ?? e.filePath ?? "(unknown)"; }
function ts(e: FileEvent) { return e.created_at ?? e.createdAt ?? ""; }
function mac(e: FileEvent) { return e.mac_address ?? e.macAddress ?? e.device_mac ?? e.deviceMac ?? null; }
function ip(e: FileEvent) { return e.ip_address ?? e.ipAddress ?? e.device_ip ?? e.deviceIp ?? null; }
function hostname(e: FileEvent) { return e.device_hostname ?? e.deviceHostname ?? null; }
function hashBefore(e: FileEvent) { return e.hash_before ?? e.hashBefore ?? null; }
function hashAfter(e: FileEvent) { return e.hash_after ?? e.hashAfter ?? null; }
function sig(e: FileEvent) { return e.device_signature ?? null; }
function deviceId(e: FileEvent) { return e.device_id ?? e.deviceId ?? null; }

function groupByPath(events: FileEvent[]) {
  const map = new Map<string, FileEvent[]>();
  for (const e of events) {
    const p = path(e);
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(e);
  }
  return Array.from(map.entries()).map(([p, evts]) => {
    const sorted = [...evts].sort((a, b) => ts(b).localeCompare(ts(a)));
    return { path: p, latest: sorted[0]!, history: sorted };
  }).sort((a, b) => ts(b.latest).localeCompare(ts(a.latest)));
}

// ─── Verify button ────────────────────────────────────────────────────────────

function VerifyButton({ event }: { event: FileEvent }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const did = deviceId(event);

  const verify = useMutation({
    mutationFn: async () => {
      if (!did) throw new Error("No device ID on this event");
      const res = await fetch(`/api/devices/${did}/verify`, {
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

// ─── Event detail row ─────────────────────────────────────────────────────────

function EventDetailRow({ event }: { event: FileEvent }) {
  const t = ts(event);
  const hb = hashBefore(event);
  const ha = hashAfter(event);
  const m = mac(event);
  const i = ip(event);
  const h = hostname(event);
  const s = sig(event);
  const sev = event.severity ?? "info";

  return (
    <div className="py-3 border-b border-border/30 last:border-0 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={ACTION_VARIANT[event.action] ?? "outline"} className="text-[10px]">{event.action}</Badge>
        <span className={cn("text-[10px] font-semibold uppercase", SEVERITY_COLOR[sev])}>{sev}</span>
        {t && <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(t)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {h && <div className="flex gap-1"><span className="text-muted-foreground">Device:</span><span className="font-mono truncate">{h}</span></div>}
        {m && <div className="flex gap-1"><span className="text-muted-foreground">MAC:</span><span className="font-mono">{m}</span></div>}
        {i && <div className="flex gap-1"><span className="text-muted-foreground">IP:</span><span className="font-mono">{i}</span></div>}
        {event.privileges_used && <div className="flex gap-1"><span className="text-muted-foreground">Priv:</span><span>{event.privileges_used}</span></div>}
      </div>

      {(hb || ha) && (
        <div className="space-y-0.5">
          {hb && <div className="text-[10px] font-mono text-muted-foreground">before: <span className="text-foreground/70">{hb.slice(0, 16)}…</span></div>}
          {ha && <div className="text-[10px] font-mono text-muted-foreground">after:  <span className="text-foreground/70">{ha.slice(0, 16)}…</span></div>}
        </div>
      )}

      {s && (
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          sig: <span className="text-foreground/60">{s.slice(0, 20)}…</span>
        </div>
      )}

      <div className="flex justify-end">
        <VerifyButton event={event} />
      </div>
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({ group }: { group: { path: string; latest: FileEvent; history: FileEvent[] } }) {
  const [expanded, setExpanded] = useState(false);
  const { latest, history } = group;
  const t = ts(latest);
  const m = mac(latest);
  const h = hostname(latest);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
      >
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-foreground truncate">{group.path}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant={ACTION_VARIANT[latest.action] ?? "outline"} className="text-[10px]">{latest.action}</Badge>
            {t && <span className="text-[10px] text-muted-foreground">{formatDate(t)}</span>}
            {h && <span className="text-[10px] text-muted-foreground">by {h}</span>}
            {m && <span className="text-[10px] font-mono text-muted-foreground">{m}</span>}
            <span className="text-[10px] text-muted-foreground">{history.length} event{history.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-2 bg-secondary/10 border-t border-border/30">
          {history.map(e => <EventDetailRow key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FileMonitor() {
  const { data, isLoading } = useQuery<FileEvent[]>({
    queryKey: ["file-events-latest"],
    queryFn: () => fetch("/api/files/latest").then(r => r.json()),
    refetchInterval: 15000,
  });

  const events: FileEvent[] = Array.isArray(data) ? data : [];
  const groups = groupByPath(events);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">File Monitor</h1>
          <p className="text-muted-foreground mt-1">Cryptographic audit trail — one row per file, most recent on top</p>
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
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary/30 rounded-xl animate-pulse" />)}
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
              {groups.map(g => <FileRow key={g.path} group={g} />)}
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
