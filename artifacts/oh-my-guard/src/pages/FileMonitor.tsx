import React from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardContent, Badge } from "@/components/ui-elements";
import { FileCode2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function FileMonitor() {
  const { list } = useFiles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">File Integrity Monitoring</h1>
          <p className="text-muted-foreground mt-1">Real-time tracking of file modifications and access</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">File Path</th>
                  <th className="px-6 py-4 font-medium">Endpoint</th>
                  <th className="px-6 py-4 font-medium">Integrity Hash (SHA256)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {list.data?.map(event => {
                  const actionColors = {
                    create: 'success',
                    edit: 'warning',
                    delete: 'destructive',
                    rename: 'primary',
                    view: 'outline'
                  } as const;

                  return (
                    <tr key={event.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(event.createdAt)}</td>
                      <td className="px-6 py-4">
                        <Badge variant={actionColors[event.action]}>{event.action.toUpperCase()}</Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px] text-foreground">{event.filePath}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{event.deviceHostname || `Device ${event.deviceId}`}</td>
                      <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground">
                        {event.hashBefore && event.hashAfter ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate w-24" title={event.hashBefore}>{event.hashBefore.substring(0,8)}...</span>
                            <ArrowRight className="w-3 h-3 text-primary" />
                            <span className="truncate w-24 text-primary" title={event.hashAfter}>{event.hashAfter.substring(0,8)}...</span>
                          </div>
                        ) : (
                          <span className="text-primary">{event.hashAfter || event.hashBefore || 'N/A'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {list.data?.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No file events recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
