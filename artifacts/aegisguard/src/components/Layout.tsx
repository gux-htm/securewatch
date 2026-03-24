import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, LayoutDashboard, Laptop, Network, ShieldAlert, Fingerprint, FileCode2, History, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Laptop },
  { href: "/networks", label: "Networks (VPN)", icon: Network },
  { href: "/firewall", label: "Firewall", icon: ShieldAlert },
  { href: "/ids", label: "IDS / IPS", icon: Fingerprint },
  { href: "/files", label: "File Monitor", icon: FileCode2 },
  { href: "/audit", label: "Audit Logs", icon: History },
  { href: "/policies", label: "Policies", icon: KeyRound },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-foreground tracking-wide leading-tight">AEGIS<span className="text-primary">GUARD</span></h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Enterprise SOC</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto z-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-[0.02] mix-blend-screen pointer-events-none" />
        <div className="p-8 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
