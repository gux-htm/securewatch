content = r'''import React, { useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { Card, CardContent, Badge, Button, Modal, Input } from "@/components/ui-elements";
import { formatDate } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Laptop, Plus, CheckCircle, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body;
}

export default function Devices() {
  const { list, register, update, verify } = useDevices();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: async (deviceId: number) => {
      const res = await fetch(`/api/devices/${deviceId}/approve`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Approval failed");
      return body;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  const deleteOne = useMutation({
    mutationFn: (deviceId: number) => apiDelete(`/api/devices/${deviceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  const deleteAll = useMutation({
    mutationFn: () => apiDelete("/api/devices/all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      setDeleteAllOpen(false);
      setDeleteAllConfirm("");
    },
  });

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await register.mutateAsync({
      data: {
        hostname: fd.get("hostname") as string,
        mac: fd.get("mac") as string,
        ip: fd.get("ip") as string,
        certFingerprint: fd.get("cert") as string,
        platform: fd.get("platform") as string,
      }
    });
    setIsRegisterOpen(false);
  };

  const handleVerify = async (device: any) => {
    try {
      const res = await verify.mutateAsync({ id: device.id, data: { mac: device.mac, ip: device.ip, certFingerprint: device.certFingerprint } });
      setVerifyResult({ device, res });
    } catch { alert("Verification failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Endpoint Devices</h1>
          <p className="text-muted-foreground mt-1">Manage registered devices and zero-trust verification</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setDeleteAllOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete All Devices
          </Button>
          <Button onClick={() => setIsRegisterOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Register Device
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Hostname</th>
                  <th className="px-6 py-4 font-medium">Network Details</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Platform</th>
                  <th className="px-6 py-4 font-medium">Last Seen</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(Array.isArray(list.data) ? list.data : []).map((device: any) => (
                  <tr key={device.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                          <Laptop className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground">{device.hostname}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-primary">{device.ip}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{device.mac}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={device.status === "active" ? "success" : device.status === "blocked" ? "destructive" : "outline"}>
                        {device.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{device.platform}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(device.lastSeen || device.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(device.status === "pending_vpn" || device.status === "pending_approval") && (
                          <Button variant="outline" className="h-8 px-3 text-xs border-emerald-600 text-emerald-400 hover:bg-emerald-600/20"
                            onClick={() => approve.mutate(device.id)} isLoading={approve.isPending}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        )}
                        <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => handleVerify(device)}>
                          Verify
                        </Button>
                        <Button variant={device.status === "blocked" ? "outline" : "destructive"} className="h-8 px-3 text-xs"
                          onClick={() => update.mutate({ id: device.id, data: { status: device.status === "blocked" ? "active" : "blocked" } })}>
                          {device.status === "blocked" ? "Unblock" : "Block"}
                        </Button>
                        <Button variant="destructive" className="h-8 px-3 text-xs"
                          onClick={() => { if (confirm(`Delete device "${device.hostname}"?`)) deleteOne.mutate(device.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.isArray(list.data) && list.data.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No devices registered.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete All confirmation modal */}
      <Modal isOpen={deleteAllOpen} onClose={() => { setDeleteAllOpen(false); setDeleteAllConfirm(""); }} title="Delete All Devices">
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive text-sm">
            This will permanently delete <strong>all devices</strong> and their sessions, audit logs, file events, and VPN issuances. This cannot be undone.
          </div>
          <p className="text-sm text-muted-foreground">Type <strong>DELETE</strong> to confirm:</p>
          <Input value={deleteAllConfirm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteAllConfirm(e.target.value)} placeholder="DELETE" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setDeleteAllOpen(false); setDeleteAllConfirm(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleteAllConfirm !== "DELETE" || deleteAll.isPending}
              onClick={() => deleteAll.mutate()} isLoading={deleteAll.isPending}>
              Delete All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Register modal */}
      <Modal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} title="Register New Endpoint">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Hostname</label>
            <Input name="hostname" required placeholder="desktop-johndoe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">IP Address</label>
              <Input name="ip" required placeholder="10.0.0.45" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-muted-foreground">MAC Address</label>
              <Input name="mac" required placeholder="00:1A:2B:3C:4D:5E" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Certificate Fingerprint</label>
            <Input name="cert" required placeholder="SHA256:..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Platform</label>
            <Input name="platform" required placeholder="Windows 11 / macOS" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsRegisterOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={register.isPending}>Register Device</Button>
          </div>
        </form>
      </Modal>

      {/* Verify result modal */}
      <Modal isOpen={!!verifyResult} onClose={() => setVerifyResult(null)} title="Zero-Trust Verification Result">
        {verifyResult && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border flex items-start gap-4 ${verifyResult.res.allowed ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
              {verifyResult.res.allowed ? <ShieldCheck className="w-6 h-6 mt-1" /> : <ShieldAlert className="w-6 h-6 mt-1" />}
              <div>
                <h3 className="font-bold text-lg">{verifyResult.res.allowed ? "Access Granted" : "Access Denied"}</h3>
                <p className="text-sm opacity-90 mt-1">{verifyResult.res.reason}</p>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Cryptographic Match</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between"><span>MAC Address:</span><span className={verifyResult.res.matchedFields?.mac ? "text-success" : "text-destructive"}>{verifyResult.res.matchedFields?.mac ? "MATCH" : "FAIL"}</span></div>
                <div className="flex justify-between"><span>IP Address:</span><span className={verifyResult.res.matchedFields?.ip ? "text-success" : "text-destructive"}>{verifyResult.res.matchedFields?.ip ? "MATCH" : "FAIL"}</span></div>
                <div className="flex justify-between"><span>Certificate:</span><span className={verifyResult.res.matchedFields?.certFingerprint ? "text-success" : "text-destructive"}>{verifyResult.res.matchedFields?.certFingerprint ? "MATCH" : "FAIL"}</span></div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setVerifyResult(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
'''

import os
dst = r"artifacts/oh-my-guard/src/pages/Devices.tsx"
with open(dst, "w", encoding="utf-8") as f:
    f.write(content)
print("Written", os.path.getsize(dst), "bytes")
