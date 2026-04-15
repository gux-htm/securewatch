content = r'''import { useState } from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardContent, Badge } from "@/components/ui-elements";
import { Shield, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const ACTION_VARIANT: Record<string, string> = {
  create: "success",
  edit: "warning",
  delete: "destructive",
  rename: "default",
  view: "outline",
};

interface FileEvent {
  id: number;
  file_path?: string;
  filePath?: string;
  action: string;
  hash_before?: string | null;
  hashBefore?: string | null;
  hash_after?: string | null;
  hashAfter?: string | null;
  created_at?: string;
  createdAt?: string;
  device_hostname?: string | null;
  deviceId?: number | null;
  privilegesUsed?: string | null;
}

interface FileGroup {
  path: string;
  latest: FileEvent;
  history: FileEvent[];
}

function groupByPath(events: FileEvent[]): FileGroup[] {
  const map = new Map<string, FileEvent[]>();
  for (const e of events) {
    const p = e.file_path ?? e.filePath ?? "(unknown)";
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(e);
  }
  return Array.from(map.entries()).map(([path, evts]) => {
    const sorted = [...evts].sort((a, b) => {
      const ta = a.created_at ?? a.createdAt ?? "";
      const tb = b.created_at ?? b.createdAt ?? "";
      return tb.localeCompare(ta);
    });
    return { path, latest: sorted[0]!, history: sorted };
  });
}

function HashChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="text-[10px] font-mono text-muted-foreground">
      {label}: <span className="text-foreground/70">{value.slice(0, 10)}…</span>
    </span>
  );
}

function EventRow({ event }: { event: FileEvent }) {
  const ts = event.created_at ?? event.createdAt;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <Badge variant={(ACTION_VARIANT[event.action] ?? "outline") as "success" | "warning" | "destructive" | "default" | "outline"} className="mt-0.5 shrink-0 text-[10px]">
        {event.action}
      </Badge>
      <div className="flex-1 min-w-0 space-y-0.5">
        {event.device_hostname && (
          <p className="text-xs text-muted-foreground truncate">by {event.device_hostname}</p>
        )}
        <div className="flex gap-3 flex-wrap">
          <HashChip label="before" value={event.hash_before ?? event.hashBefore} />
          <HashChip label="after" value={event.hash_after ?? event.hashAfter} />
        </div>
        {event.privilegesUsed && (
          <p className="text-[10px] text-muted-foreground">priv: {event.privilegesUsed}</p>
        )}
      </div>
      {ts && (
        <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(ts)}</span>
      )}
    </div>
  );
}

function FileRow({ group }: { group: FileGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { latest, history, path } = group;
  const ts = latest.created_at ?? latest.createdAt;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
      >
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-foreground truncate">{path}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={(ACTION_VARIANT[latest.action] ?? "outline") as "success" | "warning" | "destructive" | "default" | "outline"} className="text-[10px]">
              {latest.action}
            </Badge>
            {ts && <span className="text-[10px] text-muted-foreground">{formatDate(ts)}</span>}
            <span className="text-[10px] text-muted-foreground">{history.length} event{history.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 bg-secondary/10 border-t border-border/30">
          {history.map((e) => <EventRow key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}

export default function FileMonitor() {
  const { list } = useFiles();
  const events: FileEvent[] = Array.isArray(list.data) ? list.data : [];
  const groups = groupByPath(events);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">File Monitor</h1>
          <p className="text-muted-foreground mt-1">Cryptographic audit trail for all monitored resources</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-primary" />
          <span>{groups.length} monitored path{groups.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-secondary/30 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {!list.isLoading && groups.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No file events recorded yet.</p>
              <p className="text-sm mt-1">Events appear here when the file watcher detects changes.</p>
            </div>
          )}
          {!list.isLoading && groups.length > 0 && (
            <div className="p-4 space-y-2">
              {groups.map((g) => <FileRow key={g.path} group={g} />)}
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
