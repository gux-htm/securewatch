tail = r"""
function VpnReadyStep({ status }: { status: DeviceStatus }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
        <Wifi size={28} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-slate-200 font-medium">VPN Config Downloaded</p>
        <p className="text-slate-400 text-sm">Import the .ovpn file into your OpenVPN client and connect.</p>
      </div>
      <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 text-left space-y-3">
        <p className="text-xs font-semibold text-slate-300">Next steps</p>
        {["Open your OpenVPN client", `Import omg-${status.device_id}.ovpn`, "Connect to the VPN", "Open the device portal to access your files"].map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] text-emerald-400 font-bold">{i + 1}</span>
            </div>
            <span className="text-xs text-slate-300">{s}</span>
          </div>
        ))}
      </div>
      <div className="w-full bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">Assigned IP</span>
        <span className="text-xs font-mono text-emerald-300">{status.static_ip}</span>
      </div>
    </div>
  );
}

export default function DeviceRegistrationPage() {
  const [step, setStep] = useState<Step>("form");
  const [mac, setMac] = useState("");
  const [deviceId, setDeviceId] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  function onRegistered(registeredMac: string, s: DeviceStatus) {
    setMac(registeredMac);
    setDeviceId(s.device_id);
    setDeviceStatus(s);
    setStep(s.approved ? (s.status === "vpn_issued" ? "vpn_ready" : "approved") : "pending");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Shield size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="font-bold text-sm text-slate-100 leading-tight">Oh-My-Guard!</p>
          <p className="text-[10px] text-slate-500 leading-tight">Device Registration</p>
        </div>
      </div>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
        <StepBar current={step} />
        {step === "form" && <RegistrationForm onDone={onRegistered} />}
        {step === "pending" && <PendingStep mac={mac} deviceId={deviceId} onApproved={(s) => { setDeviceStatus(s); setStep("approved"); }} />}
        {step === "approved" && deviceStatus && <ApprovedStep status={deviceStatus} onVpnIssued={() => setStep("vpn_ready")} />}
        {step === "vpn_ready" && deviceStatus && <VpnReadyStep status={deviceStatus} />}
      </div>
      <p className="mt-6 text-[11px] text-slate-600 text-center max-w-xs">
        All device credentials are verified against MAC address, static IP, and digital signature before access is granted.
      </p>
    </div>
  );
}
"""

import os
dst = r"artifacts/oh-my-guard/src/pages/DeviceRegistrationPage.tsx"
with open(dst, "a", encoding="utf-8") as f:
    f.write(tail)
print("Final size:", os.path.getsize(dst), "bytes")
