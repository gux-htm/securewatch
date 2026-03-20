import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceMeta {
  id:          string;
  name:        string;
  path:        string | null;
  currentFlag: string;
  lastEventAt: string | null;
  totalEvents: number;
}

interface FileEvent {
  id:             string;
  eventType:      string;
  actorUsername:  string;
  actorIp:        string;
  actorMac:       string;
  hashBefore:     string | null;
  hashAfter:      string | null;
  hashChanged:    boolean;
  integrityFlag:  string;
  flagReason:     string | null;
  digitalSig:     string;
  occurredAt:     string;
  acknowledged:   boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const FLAG_DOT: Record<string, string> = {
  CLEAN:      'bg-green-text',
  SUSPICIOUS: 'bg-high-text',
  CRITICAL:   'bg-critical-text',
};
const FLAG_TEXT: Record<string, string> = {
  CLEAN:      'text-green-text',
  SUSPICIOUS: 'text-high-text',
  CRITICAL:   'text-critical-text',
};
const FLAG_BORDER: Record<string, string> = {
  CLEAN:      'border-border',
  SUSPICIOUS: 'border-high-border',
  CRITICAL:   'border-critical-border',
};
const FLAG_BG: Record<string, string> = {
  CLEAN:      '',
  SUSPICIOUS: 'bg-high-bg/20',
  CRITICAL:   'bg-critical-bg/20',
};

function FlagBadge({ flag, large = false }: { flag: string; large?: boolean }) {
  const dot  = FLAG_DOT[flag]  ?? 'bg-text-muted';
  const text = FLAG_TEXT[flag] ?? 'text-text-secondary';
  const size = large ? 'text-sm px-3 py-1' : 'text-[11px] px-2 py-0.5';
  const dotSize = large ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5';
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded ${size} ${text}`}>
      <span className={`rounded-full ${dotSize} ${dot} ${flag !== 'CLEAN' ? 'animate-pulse' : ''}`} />
      {flag}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="border border-border rounded-md p-4 animate-pulse flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 bg-bg-tertiary rounded" />
        <div className="h-4 w-32 bg-bg-tertiary rounded" />
        <div className="h-4 w-24 bg-bg-tertiary rounded" />
      </div>
      <div className="h-3 w-48 bg-bg-tertiary rounded" />
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  token,
  onActioned,
}: {
  event: FileEvent;
  token: string;
  onActioned: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting,   setActing]   = useState(false);

  const needsAction = !event.acknowledged &&
    (event.integrityFlag === 'SUSPICIOUS' || event.integrityFlag === 'CRITICAL');

  async function handleAction(action: 'acknowledge' | 'block_user' | 'escalate') {
    setActing(true);
    try {
      await fetch(`/api/v1/file-events/${event.id}/acknowledge`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      });
      onActioned();
    } finally {
      setActing(false);
    }
  }

  const truncHash = (h: string | null) =>
    h ? `${h.slice(0, 16)}…` : '—';

  return (
    <div className={`border rounded-md overflow-hidden transition-colors ${FLAG_BORDER[event.integrityFlag] ?? 'border-border'} ${FLAG_BG[event.integrityFlag] ?? ''}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        {/* Left: flag + event type + actor + time */}
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <FlagBadge flag={event.integrityFlag} />
          <span className="font-semibold text-sm text-text-primary">{event.eventType}</span>
          <span className="font-mono text-sm text-text-secondary">{event.actorUsername}</span>
          <span className="font-mono text-xs text-text-muted">{new Date(event.occurredAt).toLocaleString('en-GB')}</span>
          {event.acknowledged && (
            <span className="text-[11px] text-text-muted italic">acknowledged</span>
          )}
        </div>
        {/* Right: view details toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue-hover whitespace-nowrap transition-colors">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5" /> View Details</>}
        </button>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-bg-primary flex flex-col gap-4">
          {/* Two-column identity + integrity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* LEFT — Identity */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Identity</span>
              <DetailRow label="Actor"  value={event.actorUsername} mono />
              <DetailRow label="IP"     value={event.actorIp}       mono />
              <DetailRow label="MAC"    value={event.actorMac}      mono />
            </div>

            {/* RIGHT — File Integrity */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">File Integrity</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-28 shrink-0">Hash Before</span>
                <span className="font-mono text-text-secondary" title={event.hashBefore ?? ''}>{truncHash(event.hashBefore)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-28 shrink-0">Hash After</span>
                <span className="font-mono text-text-secondary" title={event.hashAfter ?? ''}>{truncHash(event.hashAfter)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-28 shrink-0">Hash Changed</span>
                {event.hashChanged
                  ? <span className="text-critical-text font-semibold">YES</span>
                  : <span className="text-green-text font-semibold">NO</span>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-28 shrink-0">Signature</span>
                {event.digitalSig
                  ? <span className="flex items-center gap-1 text-green-text font-semibold"><ShieldCheck className="w-3.5 h-3.5" /> VALID ✓</span>
                  : <span className="flex items-center gap-1 text-critical-text font-semibold"><ShieldX className="w-3.5 h-3.5" /> INVALID ✗</span>}
              </div>
            </div>
          </div>

          {/* Flag reason */}
          {event.flagReason && (
            <div className="text-xs text-text-secondary bg-bg-secondary border border-border rounded px-3 py-2">
              <span className="text-text-muted">Reason: </span>{event.flagReason}
            </div>
          )}

          {/* Action buttons — only for unacknowledged suspicious/critical */}
          {needsAction && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                disabled={acting}
                onClick={() => handleAction('acknowledge')}
                className="flex items-center gap-1.5 text-xs bg-bg-secondary border border-border hover:border-green-text text-text-primary px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                <ShieldCheck className="w-3.5 h-3.5 text-green-text" /> Acknowledge ✓
              </button>
              <button
                disabled={acting}
                onClick={() => handleAction('block_user')}
                className="flex items-center gap-1.5 text-xs bg-bg-secondary border border-border hover:border-critical-border text-text-primary px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                <ShieldX className="w-3.5 h-3.5 text-critical-text" /> Block User 🚫
              </button>
              <button
                disabled={acting}
                onClick={() => handleAction('escalate')}
                className="flex items-center gap-1.5 text-xs bg-bg-secondary border border-border hover:border-high-border text-text-primary px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                <ShieldAlert className="w-3.5 h-3.5 text-high-text" /> Escalate ⬆
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-muted w-16 shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-text-secondary' : 'text-text-secondary'}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FileEventHistory() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const token    = useAuthStore((s) => s.token);

  const [resource, setResource] = useState<ResourceMeta | null>(null);
  const [events,   setEvents]   = useState<FileEvent[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(() => {
    if (!token || !resourceId) return;
    setLoading(true);
    fetch(`/api/v1/resources/${resourceId}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { resource: ResourceMeta; events: FileEvent[] }) => {
        setResource(d.resource);
        setEvents(d.events);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [token, resourceId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/resources')}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Resources
      </button>

      {/* Header */}
      {loading ? (
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-6 w-96 bg-bg-tertiary rounded" />
          <div className="h-4 w-48 bg-bg-tertiary rounded" />
        </div>
      ) : resource ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-base text-text-primary">{resource.path ?? resource.name}</span>
            <FlagBadge flag={resource.currentFlag} large />
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>{resource.totalEvents} event{resource.totalEvents !== 1 ? 's' : ''} recorded</span>
            {resource.lastEventAt && (
              <span>Last event: <span className="font-mono">{new Date(resource.lastEventAt).toLocaleString('en-GB')}</span></span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-text-muted text-sm">Resource not found.</div>
      )}

      {/* Event timeline */}
      <div className="flex flex-col gap-3">
        {loading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : events.length === 0 ? (
          <div className="bg-bg-secondary border border-border rounded-md px-6 py-12 text-center text-text-muted text-sm">
            No events recorded for this file yet.
          </div>
        ) : (
          events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              token={token ?? ''}
              onActioned={load}
            />
          ))
        )}
      </div>
    </div>
  );
}
