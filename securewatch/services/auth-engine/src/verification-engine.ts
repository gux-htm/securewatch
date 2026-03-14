/**
 * Three-layer verification engine.
 * Layer 1: Account (C1 on failure)
 * Layer 2: Network Zone (H2 on failure)
 * Layer 3: Device Fingerprint (H1 on unregistered, C2 on blacklisted)
 *
 * Rule S1: denial_reason written ONLY to audit log — never to HTTP response.
 * Verdict CLEAN only when ALL three layers pass.
 */

import type { UniversalEvent, VerificationResult, Layer, RiskVerdict } from '@securewatch/types';
import type { IdentityCache } from '@securewatch/identity-registry';
import type { NetworkZoneResolver } from '@securewatch/identity-registry';
import type { AuditWriter } from './types.js';

export class VerificationEngine {
  constructor(
    private readonly cache: IdentityCache,
    private readonly zoneResolver: NetworkZoneResolver,
    private readonly audit: AuditWriter,
  ) {}

  async verify(event: UniversalEvent): Promise<VerificationResult> {
    const layers_passed: Layer[] = [];
    const layers_failed: Layer[] = [];
    let verdict: RiskVerdict = 'CLEAN';
    let failed_reason: string | null = null;
    let alert_code: string | null = null;

    // ── Layer 1: Account Verification ────────────────────────────────────────
    if (event.account_id) {
      const account = await this.cache.getAccount(event.tenant_id, event.account_id);

      if (!account) {
        verdict = 'CRITICAL';
        failed_reason = `Account ${event.account_id} not found in registry`;
        alert_code = 'C1';
        layers_failed.push('LAYER_1_ACCOUNT');

        await this.writeAudit(event, 'LAYER_1_ACCOUNT', failed_reason, verdict, alert_code);
        return { verdict, layers_passed, layers_failed, failed_reason: null, alert_code };
      }

      if (account.status !== 'ACTIVE') {
        verdict = 'CRITICAL';
        failed_reason = `Account status is ${account.status}`;
        alert_code = 'C1';
        layers_failed.push('LAYER_1_ACCOUNT');

        await this.writeAudit(event, 'LAYER_1_ACCOUNT', failed_reason, verdict, alert_code);
        return { verdict, layers_passed, layers_failed, failed_reason: null, alert_code };
      }

      layers_passed.push('LAYER_1_ACCOUNT');
    }

    // ── Layer 2: Network Zone Verification ───────────────────────────────────
    if (event.source_ip) {
      const zone = this.zoneResolver.resolve(event.source_ip);

      if (!zone) {
        verdict = 'SUSPICIOUS';
        failed_reason = `Source IP ${event.source_ip} is outside all registered network zones`;
        alert_code = 'H2';
        layers_failed.push('LAYER_2_NETWORK');

        await this.writeAudit(event, 'LAYER_2_NETWORK', failed_reason, verdict, alert_code);
        return { verdict, layers_passed, layers_failed, failed_reason: null, alert_code };
      }

      layers_passed.push('LAYER_2_NETWORK');
    }

    // ── Layer 3: Device Fingerprint Verification ─────────────────────────────
    if (event.device_id) {
      const device = await this.cache.getDevice(event.tenant_id, event.device_id);

      if (!device) {
        verdict = 'SUSPICIOUS';
        failed_reason = `Device ${event.device_id} not found in registry`;
        alert_code = 'H1';
        layers_failed.push('LAYER_3_DEVICE');

        await this.writeAudit(event, 'LAYER_3_DEVICE', failed_reason, verdict, alert_code);
        return { verdict, layers_passed, layers_failed, failed_reason: null, alert_code };
      }

      if (device.status === 'BLACKLISTED') {
        verdict = 'CRITICAL';
        failed_reason = `Device ${event.device_id} is BLACKLISTED: ${device.blacklist_reason ?? 'no reason given'}`;
        alert_code = 'C2';
        layers_failed.push('LAYER_3_DEVICE');

        await this.writeAudit(event, 'LAYER_3_DEVICE', failed_reason, verdict, alert_code);
        return { verdict, layers_passed, layers_failed, failed_reason: null, alert_code };
      }

      layers_passed.push('LAYER_3_DEVICE');
    }

    // All layers passed — CLEAN
    await this.audit({
      tenant_id:      event.tenant_id,
      event_category: event.event_category,
      event_type:     event.event_type,
      account_id:     event.account_id,
      device_id:      event.device_id,
      source_ip:      event.source_ip,
      outcome:        'ALLOWED',
      risk_verdict:   'CLEAN',
    });

    return {
      verdict: 'CLEAN',
      layers_passed,
      layers_failed: [],
      failed_reason: null, // Never returned to HTTP layer
      alert_code: null,
    };
  }

  private async writeAudit(
    event: UniversalEvent,
    failedLayer: Layer,
    reason: string,
    verdict: RiskVerdict,
    alertCode: string,
  ): Promise<void> {
    // Rule S1: denial_reason written to audit log only — never to HTTP response
    await this.audit({
      tenant_id:      event.tenant_id,
      event_category: event.event_category,
      event_type:     event.event_type,
      account_id:     event.account_id,
      device_id:      event.device_id,
      source_ip:      event.source_ip,
      outcome:        'DENIED',
      failed_layer:   failedLayer,
      denial_reason:  reason,  // Audit log only — never in HTTP response
      risk_verdict:   verdict,
      alert_id:       alertCode,
      severity:       verdict === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    });
  }
}
