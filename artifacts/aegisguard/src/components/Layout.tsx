import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Shield, LayoutDashboard, Laptop, Network, ShieldAlert, Fingerprint,
  FileCode2, History, KeyRound, BellRing, Monitor, Users, Users2,
  Globe, Database, Plug, Settings, X, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonitoringSummary } from "@/hooks/use-summary";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/alerts", label: "Alert Inbox", icon: BellRing, badgeKey: "unack" as const },
      { href: "/sessions", label: "Live Sessions", icon: Monitor },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/devices", label: "Devices", icon: Laptop },
      { href: "/networks", label: "Networks (VPN)", icon: Network },
      { href: "/zones", label: "Network Zones", icon: Globe },
      { href: "/firewall", label: "Firewall", icon: ShieldAlert },
      { href: "/ids", label: "IDS / IPS", icon: Fingerprint },
    ],
  },
  {
    label: "Data & Resources",
    items: [
      { href: "/files", label: "File Monitor", icon: FileCode2 },
      { href: "/resources", label: "Resource Registry", icon: Database },
      { href: "/audit", label: "Audit Logs", icon: History },
    ],
  },
  {
    label: "Access Control",
    items: [
      { href: "/accounts", label: "Accounts", icon: Users },
      { href: "/groups", label: "Groups & Privileges", icon: Users2 },
      { href: "/policies", label: "Policies", icon: KeyRound },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const summary = useMonitoringSummary();
  const data = summary.data;
  const criticalCount = data?.criticalAlertCount ?? 0;
  const unackCount = data?.unacknowledgedAlertCount ?? 0;
  const sessionCount = data?.activeSessionCount ?? 0;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showCriticalBanner = criticalCount > 0 && !bannerDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col relative z-20 overflow-y-auto">
        <div className="p-5 flex items-center gap-3 border-b border-border/50 sticky top-0 bg-card/80 backdrop-blur-xl z-10">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground tracking-wide leading-tight">AEGIS<span className="text-primary">GUARD</span></h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Enterprise SOC</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.href;
                  const badge = item.badgeKey === "unack" ? unackCount : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 transition-colors flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="flex-1">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50 sticky bottom-0 bg-card/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 border-b border-border/50 bg-card/30 backdrop-blur-xl flex items-center px-6 gap-6 flex-shrink-0 z-10">
          <div className="flex-1" />
          <div className="flex items-center gap-5 text-xs font-mono text-muted-foreground">
            <TopbarStat
              label="Critical"
              value={criticalCount}
              color={criticalCount > 0 ? "text-destructive" : "text-muted-foreground"}
              dot={criticalCount > 0 ? "bg-destructive animate-pulse" : "bg-muted-foreground"}
            />
            <TopbarStat
              label="Unacked"
              value={unackCount}
              color={unackCount > 0 ? "text-warning" : "text-muted-foreground"}
              dot={unackCount > 0 ? "bg-warning" : "bg-muted-foreground"}
            />
            <TopbarStat
              label="Sessions"
              value={sessionCount}
              color="text-primary"
              dot="bg-primary animate-pulse"
            />
            <div className="flex items-center gap-2 text-muted-foreground/40">
              <span>|</span>
              <span className="text-[10px]">↻ 30s</span>
            </div>
          </div>
        </header>

        {/* Critical Alert Banner */}
        {showCriticalBanner && (
          <div className="flex items-center gap-3 px-6 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm flex-shrink-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              <strong>{criticalCount} unacknowledged critical alert{criticalCount !== 1 ? "s" : ""}</strong> — immediate attention required.
              <Link href="/alerts" className="ml-2 underline text-destructive/80 hover:text-destructive">View Alerts →</Link>
            </span>
            <button onClick={() => setBannerDismissed(true)} className="text-destructive/60 hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 relative overflow-y-auto z-10">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-[0.02] mix-blend-screen pointer-events-none" />
          <div className="p-8 max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function TopbarStat({ label, value, color, dot }: { label: string; value: number; color: string; dot: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-muted-foreground/60">{label}:</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
