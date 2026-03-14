/**
 * Integration health monitor — background job, runs every 30 seconds.
 * TDD section 3.5. Fires C4 (CRITICAL) on silent systems, H5 (HIGH) on degraded.
 */

import type { IntegrationRegistry } from './integration-registry.js';
import type { writeAuditEntry } from './audit-log.js';

type AuditWriter = typeof writeAuditEntry;

function minutesSince(date: Date): number {
  return (Date.now() - date.getTime()) / 60000;
}

export class HealthMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly audit: AuditWriter,
    private readonly intervalMs: number = 30_000,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.check();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async check(): Promise<void> {
    try {
      const systems = await this.registry.getAllActive();

      for (const system of systems) {
        const state = await this.registry.getConnectionState(system.system_id);
        if (!state || !state.last_event_at) continue;

        const silenceMins = minutesSince(new Date(state.last_event_at));
        const threshold = state.threshold_mins;

        if (silenceMins > threshold && system.status !== 'SILENT') {
          await this.registry.updateStatus(system.system_id, 'SILENT');
          await this.audit({
            tenant_id:      system.tenant_id,
            event_category: 'INTEGRATION',
            event_type:     'INTEGRATION_SILENT',
            outcome:        'FLAGGED',
            source_system:  system.system_id,
            denial_reason:  `No events for ${silenceMins.toFixed(1)} minutes (threshold: ${threshold})`,
            severity:       'CRITICAL',
            // alert_code C4 — alert-manager will fire this via Kafka consumer
          });
        } else if (
          silenceMins > threshold * 0.8 &&
          silenceMins <= threshold &&
          system.status === 'ACTIVE'
        ) {
          await this.registry.updateStatus(system.system_id, 'DEGRADED');
          await this.audit({
            tenant_id:      system.tenant_id,
            event_category: 'INTEGRATION',
            event_type:     'INTEGRATION_DEGRADED',
            outcome:        'FLAGGED',
            source_system:  system.system_id,
            severity:       'HIGH',
          });
        }
      }
    } catch (err) {
      // Health monitor errors must not crash the service
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.audit({
        tenant_id:      'system',
        event_category: 'SYSTEM',
        event_type:     'HEALTH_MONITOR_ERROR',
        outcome:        'FLAGGED',
        denial_reason:  message,
        severity:       'HIGH',
      }).catch(() => undefined); // Last-resort — never throw from monitor
    }
  }
}
