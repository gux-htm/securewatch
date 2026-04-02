import React from "react";
import { useAudit } from "@/hooks/use-audit";
import { Card, CardContent } from "@/components/ui-elements";
import { formatDate } from "@/lib/utils";

export default function AuditLogs() {
  const { list } = useAudit();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Immutable Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Cryptographically signed system events</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Event ID</th>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Severity</th>
                  <th className="px-6 py-4 font-medium">Context (IP/Device)</th>
                  <th className="px-6 py-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono text-xs">
                {(Array.isArray(list.data) ? list.data : []).map(log => {
                   const severityColors = {
                    critical: 'text-destructive',
                    error: 'text-destructive',
                    warning: 'text-warning',
                    info: 'text-primary'
                  };
                  return (
                    <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground">{log.eventId.substring(0,8)}...</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(log.createdAt)}</td>
                      <td className="px-6 py-4 font-sans font-medium text-foreground">{log.eventType}</td>
                      <td className={`px-6 py-4 uppercase ${severityColors[log.severity]}`}>{log.severity}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                        {log.deviceHostname && <div>Host: {log.deviceHostname}</div>}
                      </td>
                      <td className="px-6 py-4 font-sans text-muted-foreground max-w-xs truncate" title={log.details}>
                        {log.details || '-'}
                      </td>
                    </tr>
                  )
                })}
                {Array.isArray(list.data) && list.data.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground font-sans">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
