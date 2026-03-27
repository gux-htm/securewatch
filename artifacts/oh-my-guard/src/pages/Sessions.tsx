import React, { useState } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui-elements";
import { Monitor, Search, XCircle, RefreshCw, Link as LinkIcon } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/utils";

const verdictVariant: Record<string, any> = {
  CLEAN: "success",
  SUSPICIOUS: "warning",
  CRITICAL: "destructive",
};

export default function Sessions() {
  const [search, setSearch] = useState("");
  const { list, terminate } = useSessions(search || undefined);
  const [, navigate] = useLocation();
  const sessions: any[] = list.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Live Session Monitor</h1>
          <p className="text-muted-foreground mt-1">
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""} · auto-refreshes every 10s
          </p>
        </div>
        <Button variant="outline" onClick={() => list.refetch()}>
          <RefreshCw className={`w-4 h-4 mr-2 ${list.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by username, IP address or device fingerprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">IP Address</th>
                  <th className="px-6 py-4 font-medium">Device</th>
                  <th className="px-6 py-4 font-medium">Risk</th>
                  <th className="px-6 py-4 font-medium">Started</th>
                  <th className="px-6 py-4 font-medium">Last Active</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {list.isLoading && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    <div className="flex justify-center"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>
                  </td></tr>
                )}
                {!list.isLoading && sessions.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Monitor className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No active sessions</p>
                  </td></tr>
                )}
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {s.username[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{s.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-primary">{s.ipAddress || "—"}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {s.deviceFingerprint || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={verdictVariant[s.riskVerdict] || "outline"}>{s.riskVerdict}</Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{formatDate(s.createdAt)}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{formatDate(s.lastActivity)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" title="View audit logs for this user"
                          onClick={() => navigate(`/audit?user=${s.username}`)}>
                          <LinkIcon className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => terminate.mutate({ id: s.id })}
                          isLoading={terminate.isPending}>
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
