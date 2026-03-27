import React, { useState } from "react";
import { useIds } from "@/hooks/use-ids";
import { Card, CardContent, Badge, Button, Modal, Input, Select } from "@/components/ui-elements";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function IdsIps() {
  const { signatures, createSignature, alerts, resolveAlert } = useIds();
  const [tab, setTab] = useState<'alerts'|'signatures'>('alerts');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Intrusion Detection</h1>
          <p className="text-muted-foreground mt-1">IDS/IPS signatures and active threat alerts</p>
        </div>
        <div className="flex bg-secondary/50 p-1 rounded-lg border border-border/50">
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === 'alerts' ? 'bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('alerts')}
          >
            Active Alerts
          </button>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === 'signatures' ? 'bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('signatures')}
          >
            Signatures
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {tab === 'alerts' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Severity</th>
                    <th className="px-6 py-4 font-medium">Time</th>
                    <th className="px-6 py-4 font-medium">Signature / Rule</th>
                    <th className="px-6 py-4 font-medium">Source IP</th>
                    <th className="px-6 py-4 font-medium">Action Taken</th>
                    <th className="px-6 py-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {alerts.data?.map(alert => {
                    const severityColors = {
                      critical: 'text-destructive bg-destructive/10 border-destructive/30',
                      high: 'text-warning bg-warning/10 border-warning/30',
                      medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
                      low: 'text-blue-400 bg-blue-400/10 border-blue-400/30'
                    };
                    return (
                      <tr key={alert.id} className={`hover:bg-secondary/20 transition-colors ${alert.resolved ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${severityColors[alert.severity]}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(alert.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{alert.signatureName || 'Unknown Signature'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{alert.deviceHostname}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-primary">{alert.sourceIp}</td>
                        <td className="px-6 py-4">
                          <Badge variant={alert.action === 'block' || alert.action === 'drop' ? 'destructive' : 'warning'}>
                            {alert.action.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {alert.resolved ? (
                            <span className="inline-flex items-center text-success text-xs font-medium"><CheckCircle2 className="w-4 h-4 mr-1" /> Resolved</span>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => resolveAlert.mutate({ id: alert.id })}>
                              Resolve
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {alerts.data?.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No active alerts. System secure.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Signature Name</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Pattern Match</th>
                    <th className="px-6 py-4 font-medium">Severity</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {signatures.data?.map(sig => (
                    <tr key={sig.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{sig.name}</td>
                      <td className="px-6 py-4 text-muted-foreground capitalize">{sig.category}</td>
                      <td className="px-6 py-4 font-mono text-xs text-primary bg-background/50 px-2 py-1 rounded inline-block mt-3 border border-border/50">{sig.pattern}</td>
                      <td className="px-6 py-4 capitalize">{sig.severity}</td>
                      <td className="px-6 py-4 uppercase font-semibold text-xs text-muted-foreground">{sig.action}</td>
                    </tr>
                  ))}
                  {signatures.data?.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No signatures defined.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
