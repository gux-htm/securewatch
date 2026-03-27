import React, { useEffect, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui-elements";
import { Settings as SettingsIcon, Bell, Clock, Shield, Globe, Mail, Webhook, Save } from "lucide-react";

const THRESHOLD_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export default function Settings() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setForm(settings.data as Record<string, string>);
      setDirty(false);
    }
  }, [settings.data]);

  const set = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    await save.mutateAsync(form);
    setDirty(false);
  };

  if (settings.isLoading) {
    return <div className="flex justify-center p-16"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings &amp; Notifications</h1>
          <p className="text-muted-foreground mt-1">Platform configuration and alerting preferences</p>
        </div>
        <Button onClick={handleSave} isLoading={save.isPending} disabled={!dirty}>
          <Save className="w-4 h-4 mr-2" /> Save Changes
          {dirty && <span className="ml-2 w-2 h-2 rounded-full bg-warning inline-block" />}
        </Button>
      </div>

      {/* General */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Tenant / Organization Name">
            <input value={form["tenant_name"] || ""} onChange={e => set("tenant_name", e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
          </FieldRow>
          <FieldRow label="Audit Log Retention (days)">
            <input type="number" min={7} max={3650} value={form["audit_retention_days"] || "90"} onChange={e => set("audit_retention_days", e.target.value)}
              className="w-40 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Minimum Alert Threshold" hint="Alerts below this severity are silenced">
            <select value={form["alert_threshold"] || "HIGH"} onChange={e => set("alert_threshold", e.target.value)}
              className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
              {THRESHOLD_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Session Timeout (minutes)">
            <input type="number" min={5} max={1440} value={form["session_timeout"] || "60"} onChange={e => set("session_timeout", e.target.value)}
              className="w-40 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
          </FieldRow>
          <FieldRow label="Enforce MFA for all accounts">
            <div className="flex items-center gap-3">
              <button
                onClick={() => set("mfa_enforced", form["mfa_enforced"] === "true" ? "false" : "true")}
                className={`relative w-11 h-6 rounded-full transition-colors ${form["mfa_enforced"] === "true" ? "bg-primary" : "bg-secondary"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form["mfa_enforced"] === "true" ? "translate-x-5 left-0.5" : "translate-x-0 left-0.5"}`} />
              </button>
              <span className="text-sm text-muted-foreground">{form["mfa_enforced"] === "true" ? "Enforced" : "Optional"}</span>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="w-4 h-4 text-primary" />Webhook Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Webhook URL" hint="POSTs alert payloads (Slack, Teams, custom)">
            <input type="url" value={form["webhook_url"] || ""} onChange={e => set("webhook_url", e.target.value)}
              placeholder="https://hooks.slack.com/services/..." className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground" />
          </FieldRow>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />SMTP Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="SMTP Host">
              <input value={form["smtp_host"] || ""} onChange={e => set("smtp_host", e.target.value)}
                placeholder="smtp.company.com" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
            </FieldRow>
            <FieldRow label="SMTP Port">
              <input type="number" value={form["smtp_port"] || "587"} onChange={e => set("smtp_port", e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
            </FieldRow>
          </div>
          <FieldRow label="From Address">
            <input type="email" value={form["smtp_from"] || ""} onChange={e => set("smtp_from", e.target.value)}
              placeholder="alerts@company.com" className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="SMTP Username">
              <input value={form["smtp_user"] || ""} onChange={e => set("smtp_user", e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
            </FieldRow>
            <FieldRow label="SMTP Password">
              <input type="password" value={form["smtp_pass"] || ""} onChange={e => set("smtp_pass", e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
            </FieldRow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {children}
    </div>
  );
}
