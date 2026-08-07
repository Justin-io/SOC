/**
 * AEGIS-X Backend — Alert Enricher
 * Enriches normalised alerts with asset context, correlation IDs, geolocation hints.
 */

import type { AlertRecord } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('ingestion:enricher');

// Simulated asset registry
const ASSET_GEOMAP: Record<string, string> = {
  '10.142.4.10': 'US-EAST-1 / Virginia',
  '10.240.1.54': 'US-WEST-2 / Oregon',
  '172.31.12.88': 'AWS us-east-1',
  '10.10.44.9': 'US-EAST / New York HQ',
  '10.10.22.55': 'US-EAST / SOC Floor 3',
};

export function enrichAlert(alert: AlertRecord): AlertRecord {
  const start = Date.now();

  // Geo hint from asset IP
  const geoHint = ASSET_GEOMAP[alert.incident.asset.ip] ?? 'UNKNOWN';

  // Correlation ID: link related alerts by asset IP + MITRE base
  const correlationId = `CORR-${alert.incident.asset.ip}-${alert.incident.mitreTechnique.id.split('.')[0]}`;

  const enriched: AlertRecord = {
    ...alert,
    geoHint,
    correlationId,
    assetId: alert.incident.asset.id,
    enrichmentLatencyMs: alert.enrichmentLatencyMs + (Date.now() - start),
  };

  log.debug('Alert enriched', {
    traceId: alert.traceId,
    meta: { geoHint, correlationId },
  });

  return enriched;
}
