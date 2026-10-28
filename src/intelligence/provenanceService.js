/**
 * DDevUltraHome — Centralized Price Data Provenance & Freshness Service
 * Compliant with Phase B & C rules:
 * - Dynamic real-time clock (zero hardcoded mock dates)
 * - ISO 8601 internal timestamps and Asia/Kolkata (IST) display formatting
 * - Complete audit provenance fields
 * - Preserves last-known-good dataset on failed refresh
 * - Concurrent refresh prevention and timeout management
 */

import { SafeMath } from '../engine/math.js';

export const ProviderStatus = {
  CONNECTED: 'CONNECTED',
  STALE: 'STALE',
  DEGRADED: 'DEGRADED',
  DISCONNECTED: 'DISCONNECTED',
  HISTORICAL_BASELINE: 'HISTORICAL_BASELINE',
  OFFLINE: 'OFFLINE'
};

export const DataOrigin = {
  LIVE_SOURCE: 'LIVE_SOURCE',
  LOCAL_CACHE: 'LOCAL_CACHE',
  HISTORICAL_BASELINE: 'HISTORICAL_BASELINE',
  DEALER_ENTRY: 'DEALER_ENTRY'
};

export const FreshnessLevel = {
  FRESH: 'FRESH',
  RECENT: 'RECENT',
  OLDER_REFERENCE: 'OLDER_REFERENCE',
  STALE: 'STALE',
  OFFICIAL_ANNUAL_SOR: 'OFFICIAL_ANNUAL_SOR',
  UNVERIFIED: 'UNVERIFIED'
};

/**
 * Format ISO 8601 string into Asia/Kolkata (IST) human-readable display string
 * @param {string|Date} dateInput
 * @param {boolean} [includeTime=true]
 * @returns {string}
 */
export function formatIST(dateInput, includeTime = true) {
  if (!dateInput) return 'Not Available';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      options.hour12 = true;
    }

    const formatter = new Intl.DateTimeFormat('en-IN', options);
    return `${formatter.format(d)} IST`;
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Generate lightweight deterministic data hash
 */
export function computeDataHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(16).padStart(8, '0');
}

export class ProvenanceService {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.cache = new Map();
    this.inFlightRefreshes = new Map();
    this.requestTimeoutMs = options.requestTimeoutMs || 5000;
  }

  /**
   * Determine data freshness based on observation date and dynamic clock
   */
  evaluateFreshness(observedDateStr, isOfficialSor = false, publishedDateStr = null) {
    if (isOfficialSor) {
      return {
        level: FreshnessLevel.OFFICIAL_ANNUAL_SOR,
        code: 'OFFICIAL_ANNUAL_SOR',
        label: 'Official TN PWD SOR (2025–26 Annual Benchmark)',
        color: '#0d6efd',
        isStale: false,
        observedAtFormatted: formatIST(observedDateStr, false),
        publishedAtFormatted: publishedDateStr ? formatIST(publishedDateStr, false) : null
      };
    }

    if (!observedDateStr) {
      return {
        level: FreshnessLevel.UNVERIFIED,
        code: 'UNVERIFIED',
        label: 'Unverified / No Timestamp',
        color: '#dc3545',
        isStale: true,
        observedAtFormatted: 'Unverified'
      };
    }

    const now = this.clock();
    const obsDate = new Date(observedDateStr);
    if (isNaN(obsDate.getTime())) {
      return {
        level: FreshnessLevel.UNVERIFIED,
        code: 'INVALID_TIMESTAMP',
        label: 'Invalid Observation Timestamp',
        color: '#dc3545',
        isStale: true,
        observedAtFormatted: 'Invalid'
      };
    }

    const ageHours = (now.getTime() - obsDate.getTime()) / (1000 * 60 * 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageHours <= 24) {
      return {
        level: FreshnessLevel.FRESH,
        code: 'FRESH',
        label: `Live / Verified Today (${Math.max(1, Math.round(ageHours))}h ago)`,
        color: '#198754',
        isStale: false,
        ageHours: SafeMath.round(ageHours, 1),
        observedAtFormatted: formatIST(obsDate, true)
      };
    } else if (ageDays <= 7) {
      return {
        level: FreshnessLevel.RECENT,
        code: 'RECENT',
        label: `Verified ${ageDays}d ago`,
        color: '#20c997',
        isStale: false,
        ageDays,
        observedAtFormatted: formatIST(obsDate, true)
      };
    } else if (ageDays <= 30) {
      return {
        level: FreshnessLevel.OLDER_REFERENCE,
        code: 'OLDER_REFERENCE',
        label: `Older Reference (${ageDays}d ago)`,
        color: '#ffc107',
        isStale: false,
        ageDays,
        observedAtFormatted: formatIST(obsDate, false)
      };
    } else {
      return {
        level: FreshnessLevel.STALE,
        code: 'STALE',
        label: `Stale Market Rate (${ageDays}d ago — Refresh Recommended)`,
        color: '#dc3545',
        isStale: true,
        ageDays,
        observedAtFormatted: formatIST(obsDate, false)
      };
    }
  }

  /**
   * Execute or retrieve dataset via pluggable adapter with complete provenance tracking
   * @param {Object} adapter - Instance of BaseSourceAdapter
   * @param {Object} [params={}]
   * @param {boolean} [params.forceRefresh=false]
   * @param {string} [params.district='Chennai']
   */
  async getDatasetWithProvenance(adapter, params = {}) {
    const key = `${adapter.id}_${params.district || 'Chennai'}`;
    const nowIso = this.clock().toISOString();

    // Check if a refresh for this adapter is already in-flight (prevent concurrent duplicate requests)
    if (this.inFlightRefreshes.has(key)) {
      return this.inFlightRefreshes.get(key);
    }

    const cachedEntry = this.cache.get(key);

    if (!params.forceRefresh && cachedEntry && cachedEntry.records && cachedEntry.records.length > 0) {
      // Re-evaluate freshness dynamically on retrieval
      const updatedMeta = { ...cachedEntry.metadata };
      const freshness = this.evaluateFreshness(
        updatedMeta.sourceObservedAt,
        adapter.isOfficialSor,
        updatedMeta.sourcePublishedAt
      );
      return {
        ...cachedEntry,
        metadata: {
          ...updatedMeta,
          isStale: freshness.isStale,
          freshnessBadge: freshness,
          lastAttemptAt: updatedMeta.lastAttemptAt || nowIso
        }
      };
    }

    // Launch refresh with timeout and error capture
    const refreshPromise = (async () => {
      let lastGoodData = cachedEntry ? cachedEntry.records : null;
      let lastGoodMeta = cachedEntry ? cachedEntry.metadata : null;

      const attemptTimestamp = this.clock().toISOString();

      try {
        // Step 1: Real availability check
        const availability = await Promise.race([
          adapter.checkAvailability(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Source availability check timed out')), this.requestTimeoutMs))
        ]);

        if (!availability.available) {
          throw new Error(availability.reason || 'Source unavailable or ping failed');
        }

        // Step 2: Fetch and validate
        const rawDataset = await Promise.race([
          adapter.fetchDataset(params),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Data fetch timed out')), this.requestTimeoutMs))
        ]);

        const parsed = await adapter.parseDataset(rawDataset, params);
        const validation = adapter.validateDataset(parsed);

        if (!validation.valid) {
          throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
        }

        const normalized = parsed.map(r => adapter.normalizeRecord(r, params));
        const dataHash = computeDataHash(normalized);
        const successTimestamp = this.clock().toISOString();
        const sourceMeta = adapter.getSourceMetadata();

        const freshness = this.evaluateFreshness(
          sourceMeta.sourceObservedAt,
          adapter.isOfficialSor,
          sourceMeta.sourcePublishedAt
        );

        const newMetadata = {
          lastAttemptAt: attemptTimestamp,
          lastSuccessfulFetchAt: successTimestamp,
          sourceObservedAt: sourceMeta.sourceObservedAt,
          sourcePublishedAt: sourceMeta.sourcePublishedAt || null,
          nextScheduledRefreshAt: this._computeNextRefresh(successTimestamp, adapter.refreshIntervalHours || 12),
          providerStatus: ProviderStatus.CONNECTED,
          dataOrigin: adapter.isOfflineOnly ? DataOrigin.HISTORICAL_BASELINE : DataOrigin.LIVE_SOURCE,
          sourceUrl: sourceMeta.sourceUrl || '',
          sourceName: sourceMeta.sourceName || adapter.name,
          district: params.district || 'Chennai',
          currency: 'INR',
          sourceRecordId: sourceMeta.version || sourceMeta.sourceRecordId || '1.0.0',
          dataHash,
          itemCount: normalized.length,
          freshnessBadge: freshness,
          isStale: freshness.isStale,
          errorCode: null,
          errorMessage: null
        };

        const result = {
          success: true,
          records: normalized,
          metadata: newMetadata
        };

        this.cache.set(key, result);
        return result;
      } catch (err) {
        // Fallback rule: Preserve last-good dataset on failure, or fall back to bundled baseline
        const errCode = err.message.includes('timed out') ? 'TIMEOUT' : 'SOURCE_UNAVAILABLE';
        const failureMeta = {
          ...(lastGoodMeta || {}),
          lastAttemptAt: attemptTimestamp,
          lastSuccessfulFetchAt: lastGoodMeta?.lastSuccessfulFetchAt || null,
          sourceObservedAt: lastGoodMeta?.sourceObservedAt || adapter.getSourceMetadata().sourceObservedAt,
          providerStatus: lastGoodData ? ProviderStatus.STALE : (adapter.isOfflineOnly ? ProviderStatus.HISTORICAL_BASELINE : ProviderStatus.DISCONNECTED),
          dataOrigin: lastGoodData ? DataOrigin.LOCAL_CACHE : DataOrigin.HISTORICAL_BASELINE,
          errorCode: errCode,
          errorMessage: err.message,
          nextScheduledRefreshAt: this._computeNextRefresh(attemptTimestamp, 1),
          district: params.district || 'Chennai',
          currency: 'INR'
        };

        const freshness = this.evaluateFreshness(
          failureMeta.sourceObservedAt,
          adapter.isOfficialSor,
          failureMeta.sourcePublishedAt
        );
        failureMeta.freshnessBadge = freshness;
        failureMeta.isStale = true;

        const records = lastGoodData || (await adapter.getFallbackRecords(params));

        const result = {
          success: false,
          error: err.message,
          records,
          metadata: failureMeta
        };

        if (records && records.length > 0) {
          this.cache.set(key, result);
        }
        return result;
      } finally {
        this.inFlightRefreshes.delete(key);
      }
    })();

    this.inFlightRefreshes.set(key, refreshPromise);
    return refreshPromise;
  }

  _computeNextRefresh(fromIsoStr, intervalHours) {
    try {
      const d = new Date(fromIsoStr);
      d.setHours(d.getHours() + intervalHours);
      return d.toISOString();
    } catch {
      return null;
    }
  }

  clearCache() {
    this.cache.clear();
    this.inFlightRefreshes.clear();
  }
}

export const defaultProvenanceService = new ProvenanceService();
export const provenanceService = defaultProvenanceService;
