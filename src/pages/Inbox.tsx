import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

interface Alert {
  id: string;
  code: string;
  severity: Severity;
  triggeredAt: string;
  username: string | null;
  detail: Record<string, unknown> | string;
  acknowledged: boolean;
  ackedAt: string | null;
}

const SEV_STYLES: Record<Severity, { badge: string; border: string; row: string }> = {
  CRITICAL: {
    badge: 'bg-critical-bg border border-critical-border text-critical-text',
    border: 'border-l-critical-border',
    row: '',
  },
  HIGH: {
    badge: 'bg-high-bg border border-high-border text-high-text',
    border: 'border-l-high-border',
    row: '',
  },
  MEDIUM: {
    badge: 'bg-medium-bg border border-medium-border text-medium-text',
    border: 'border-l-medium-border',
    row: '',
  },
  LOW: {
    badge: 'bg-low-bg border border-low-border text-low-text',
    border: 'border-l-low-border',
    row: '',
  },
  INFO: {
    badge: 'bg-bg-tertiary border border-border text-text-secondary',
    border: 'border-l-border',
    row: '',
  },
};

const DOT_COLOR: Record<Severity, string> = {
  CRITICAL: 'bg-critical-text',
  HIGH:     'bg-high-text',
  MEDIUM:   'bg-medium-text',
  LOW:      'bg-low-text',
  INFO:     'bg-text-secondary',
};

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function formatDetail(detail: Record<string, unknown> | string): string {
  if (typeof detail === 'string') return detail;
  return Object.entries(detail)
    .filter(([k]) => !['alertCode'].includes(k))
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function SkeletonRow() {
  return (
    <div className="bg-bg-secondary border border-border rounded p-3 flex flex-col gap-2 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 bg-bg-tertiary rounded" />
        <div className="h-4 w-64 bg-bg-tertiary rounded" />
      </div>
      <div className="h-3 w-96 bg-bg-tertiary rounded" />
    </div>
  );
}

export default function Inbox() {
  const token = useAuthStore((s) => s.token);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(() => {
    if (!token) return;
    fetch('/api/v1/alerts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Alert[]) => { setAlerts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  function acknowledge(id: string) {
    if (!token) return;
    fetch(`/api/v1/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => setAlerts((prev) =>
      prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a),
    ));
  }

  const unacked = alerts.filter((a) => !a.acknowledged);
  const acked   = alerts.filter((a) => a.acknowledged);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Admin Inbox</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{unacked.length} unacknowledged</span>
          <button
            onClick={() => unacked.forEach((a) => acknowledge(a.id))}
            className="bg-bg-tertiary border border-border px-3 py-1.5 rounded text-sm text-text-primary hover:border-accent-blue transition-colors"
          >
            Mark All Read
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : unacked.length === 0 && acked.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded p-12 text-center text-text-muted">
          No alerts — all systems nominal
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {SEVERITIES.map((sev) => {
            const group = unacked.filter((a) => a.severity === sev);
            if (group.length === 0) return null;
            const s = SEV_STYLES[sev];
            return (
              <div key={sev}>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 border-b border-border pb-1">
                  {sev}
                </h2>
                <div className="flex flex-col gap-2">
                  {group.map((alert) => (
                    <div
                      key={alert.id}
                      className={`bg-bg-secondary border border-border border-l-4 ${s.border} rounded flex flex-col p-3 gap-2 hover:bg-bg-hover transition-colors`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`${s.badge} text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[sev]}`} />
                            {sev}
                          </span>
                          <span className="text-sm font-medium text-text-primary">
                            {alert.code} · {formatDetail(alert.detail)}
                          </span>
                        </div>
                        <span className="text-xs text-text-secondary font-mono">
                          {timeAgo(alert.triggeredAt)}
                        </span>
                      </div>
                      {alert.username && (
                        <div className="text-sm text-text-secondary font-mono">
                          Account: {alert.username}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          onClick={() => acknowledge(alert.id)}
                          className="text-sm text-text-secondary hover:text-text-primary font-medium"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {acked.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 border-b border-border pb-1">
                ACKNOWLEDGED ({acked.length})
              </h2>
              <div className="flex flex-col gap-2">
                {acked.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-bg-secondary border border-border rounded flex items-center justify-between p-3 opacity-50"
                  >
                    <span className="text-sm text-text-secondary">
                      {alert.code} · {formatDetail(alert.detail)}
                    </span>
                    <span className="text-xs text-text-muted font-mono">
                      {timeAgo(alert.triggeredAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
