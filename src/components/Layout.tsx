import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, Bell, Inbox, Activity, Folder, Plug, Users, Monitor, Globe, UsersRound, ClipboardList, Settings } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { section: 'MONITOR' },
  { name: 'Inbox', path: '/inbox', icon: Inbox, badge: 3 },
  { name: 'Sessions', path: '/sessions', icon: Activity },
  { name: 'Resources', path: '/resources', icon: Folder },
  { name: 'Integrations', path: '/integrations', icon: Plug },
  { section: 'MANAGE' },
  { name: 'Accounts', path: '/accounts', icon: Users },
  { name: 'Devices', path: '/devices', icon: Monitor },
  { name: 'Network Zones', path: '/zones', icon: Globe },
  { name: 'Groups', path: '/groups', icon: UsersRound },
  { section: 'AUDIT' },
  { name: 'Audit Log', path: '/audit-log', icon: ClipboardList },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      <header className="h-14 bg-bg-secondary border-b border-border fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-text-primary font-semibold">
          <Shield className="w-5 h-5 text-accent-blue" />
          <span>SecureWatch</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-text-secondary flex items-center gap-1 cursor-pointer">
            Tenant: Acme Corp <span className="text-xs">▼</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-critical-bg border border-critical-border text-critical-text text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-critical-text"></span>
              3 CRITICAL
            </div>
            <div className="relative cursor-pointer">
              <Bell className="w-5 h-5 text-text-secondary hover:text-text-primary transition-colors" />
              <span className="absolute -top-1 -right-1 bg-critical-bg text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-bg-secondary">
                3
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-accent-blue flex items-center justify-center text-white font-medium">
                A
              </div>
              <span className="text-text-secondary hover:text-text-primary transition-colors">Admin ▼</span>
            </div>
          </div>
        </div>
      </header>

      <div className="fixed top-14 left-0 right-0 z-40 bg-critical-bg border-b-2 border-critical-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-critical-text text-sm font-medium">
          <span>⚠</span>
          <span>3 CRITICAL alerts require immediate attention</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button className="text-text-primary hover:underline">View All</button>
          <button className="text-text-secondary hover:text-text-primary">✕</button>
        </div>
      </div>

      <div className="flex flex-1 pt-[90px]">
        <aside className="w-[220px] bg-bg-secondary border-r border-border fixed left-0 bottom-0 top-[90px] overflow-y-auto z-30">
          <nav className="py-4 flex flex-col gap-1">
            {navItems.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={idx} className="px-4 pt-4 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    {item.section}
                  </div>
                );
              }

              const isActive = location.pathname.startsWith(item.path!);
              const Icon = item.icon!;

              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  className={clsx(
                    "flex items-center justify-between px-4 py-2 text-sm transition-colors border-l-3",
                    isActive 
                      ? "border-accent-blue bg-accent-blue-subtle text-text-primary" 
                      : "border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-critical-bg text-white text-[11px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 ml-[220px] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
