import React from "react";
import { useDashboard } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-elements";
import { Activity, ShieldAlert, Laptop, Network } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock data for the chart since the API just returns current stats
const mockTrafficData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  events: Math.floor(Math.random() * 500) + 100,
  blocked: Math.floor(Math.random() * 50) + 5,
}));

export default function Dashboard() {
  const { stats, invalidate } = useDashboard();
  const data = stats.data;

  if (stats.isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (stats.isError) {
    return <div className="text-destructive">Failed to load dashboard statistics.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Global Security Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time telemetry and threat metrics</p>
        </div>
        <button onClick={invalidate} className="px-4 py-2 text-sm bg-secondary/50 hover:bg-secondary rounded-lg border border-border/50 text-foreground transition-colors flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Endpoints" value={data?.totalDevices} sub={`${data?.activeDevices} Active`} icon={Laptop} color="text-primary" bg="bg-primary/10" />
        <StatCard title="Active Alerts" value={data?.activeAlerts} sub={`${data?.criticalAlerts} Critical`} icon={ShieldAlert} color="text-warning" bg="bg-warning/10" />
        <StatCard title="VPN Networks" value={data?.totalNetworks} sub="Active Tunnels" icon={Network} color="text-success" bg="bg-success/10" />
        <StatCard title="File Events" value={data?.totalFileEvents} sub="Last 24h" icon={Activity} color="text-accent" bg="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Network Traffic & Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(189 94% 43%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(189 94% 43%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(346 87% 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(346 87% 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" vertical={false} />
                  <XAxis dataKey="time" stroke="hsl(215 20% 65%)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(215 20% 65%)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(222 47% 10%)', borderColor: 'hsl(217 32% 17%)', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(210 40% 98%)' }}
                  />
                  <Area type="monotone" dataKey="events" stroke="hsl(189 94% 43%)" fillOpacity={1} fill="url(#colorEvents)" strokeWidth={2} />
                  <Area type="monotone" dataKey="blocked" stroke="hsl(346 87% 50%)" fillOpacity={1} fill="url(#colorBlocked)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <HealthIndicator label="Firewall Rules" status="optimal" value={data?.totalFirewallRules || 0} />
            <HealthIndicator label="Endpoint Protection" status="warning" value={`${data?.activeDevices}/${data?.totalDevices}`} />
            <HealthIndicator label="Audit Logs" status="optimal" value={data?.recentAuditLogs || 0} />
            <HealthIndicator label="Intrusion Detection" status={data?.criticalAlerts ? "critical" : "optimal"} value={data?.activeAlerts || 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, bg }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h2 className="text-3xl font-display font-bold text-foreground">{value || 0}</h2>
            <span className="text-xs font-mono text-muted-foreground">{sub}</span>
          </div>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthIndicator({ label, status, value }: any) {
  const colors = {
    optimal: "bg-success",
    warning: "bg-warning",
    critical: "bg-destructive"
  };
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${colors[status as keyof typeof colors]} w-full opacity-80`} />
      </div>
    </div>
  );
}
