import React, { useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Modal, Input } from "@/components/ui-elements";
import { formatDate } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Laptop, Plus, MoreVertical, Ban, Trash2 } from "lucide-react";

export default function Devices() {
  const { list, register, update, remove, verify } = useDevices();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

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
      const res = await verify.mutateAsync({
        id: device.id,
        data: {
          mac: device.mac,
          ip: device.ip,
          certFingerprint: device.certFingerprint
        }
      });
      setVerifyResult({ device, res });
    } catch (err) {
      alert("Verification failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Endpoint Devices</h1>
          <p className="text-muted-foreground mt-1">Manage registered devices and zero-trust verification</p>
        </div>
        <Button onClick={() => setIsRegisterOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register Device
        </Button>
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
                {(Array.isArray(list.data) ? list.data : []).map(device => (
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
                      <Badge variant={device.status === 'active' ? 'success' : device.status === 'blocked' ? 'destructive' : 'outline'}>
                        {device.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{device.platform}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(device.lastSeen || device.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => handleVerify(device)}>
                          Verify
                        </Button>
                        <Button 
                          variant={device.status === 'blocked' ? 'outline' : 'destructive'} 
                          className="h-8 px-3 text-xs"
                          onClick={() => update.mutate({ id: device.id, data: { status: device.status === 'blocked' ? 'active' : 'blocked' } })}
                        >
                          {device.status === 'blocked' ? 'Unblock' : 'Block'}
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

      <Modal isOpen={!!verifyResult} onClose={() => setVerifyResult(null)} title="Zero-Trust Verification Result">
        {verifyResult && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border flex items-start gap-4 ${verifyResult.res.allowed ? 'bg-success/10 border-success/30 text-success' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
              {verifyResult.res.allowed ? <ShieldCheck className="w-6 h-6 mt-1" /> : <ShieldAlert className="w-6 h-6 mt-1" />}
              <div>
                <h3 className="font-bold text-lg">{verifyResult.res.allowed ? 'Access Granted' : 'Access Denied'}</h3>
                <p className="text-sm opacity-90 mt-1">{verifyResult.res.reason}</p>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Cryptographic Match</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between"><span>MAC Address:</span> <span className={verifyResult.res.matchedFields?.mac ? 'text-success' : 'text-destructive'}>{verifyResult.res.matchedFields?.mac ? 'MATCH' : 'FAIL'}</span></div>
                <div className="flex justify-between"><span>IP Address:</span> <span className={verifyResult.res.matchedFields?.ip ? 'text-success' : 'text-destructive'}>{verifyResult.res.matchedFields?.ip ? 'MATCH' : 'FAIL'}</span></div>
                <div className="flex justify-between"><span>Certificate:</span> <span className={verifyResult.res.matchedFields?.certFingerprint ? 'text-success' : 'text-destructive'}>{verifyResult.res.matchedFields?.certFingerprint ? 'MATCH' : 'FAIL'}</span></div>
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
