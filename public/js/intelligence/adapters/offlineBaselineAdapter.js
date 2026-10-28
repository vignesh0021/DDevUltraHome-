/**
 * DDevUltraHome — Immutable Offline Historical Reference Adapter
 * Provides verified baseline rates for 100% offline usage.
 * Non-negotiable rules:
 * - Must be strictly labelled as HISTORICAL_BASELINE or CACHED.
 * - Never change observation date to current date.
 * - Fallback values must never inherit live provider's provenance.
 */

import { BaseSourceAdapter } from './baseAdapter.js';
import { RAW_MATERIAL_BENCHMARKS, DISTRICT_PRICE_INDEX } from '../materialRates.js';
import { SafeMath } from '../../engine/math.js';

export class OfflineBaselineAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super({
      id: options.id || 'offline_reference',
      name: 'Pre-Bundled Offline Historical Reference',
      type: 'HISTORICAL_BASELINE',
      isOfficialSor: false,
      isOfflineOnly: true,
      refreshIntervalHours: 0, // Immutable offline snapshot
      sourceUrl: 'BUNDLED_OFFLINE_STORAGE',
      sourceObservedAt: '2026-10-25T00:00:00.000Z',
      sourcePublishedAt: '2026-10-25T00:00:00.000Z'
    });
    this.immutableBaseline = RAW_MATERIAL_BENCHMARKS.map(item => ({
      itemCode: item.itemCode,
      name: item.standardName,
      category: item.category,
      unit: item.unit,
      price: item.marketPrice,
      taxStatus: item.taxStatus,
      transportStatus: item.transportStatus,
      observedDate: '2026-10-25'
    }));
  }

  async checkAvailability() {
    return {
      available: true,
      latencyMs: 0,
      reason: 'Embedded offline historical reference available without network'
    };
  }

  async fetchDataset(params = {}) {
    return this.immutableBaseline;
  }

  async parseDataset(raw, params = {}) {
    const district = params.district || 'Chennai';
    const index = DISTRICT_PRICE_INDEX[district] || 1.0;

    return raw.map(item => ({
      itemCode: item.itemCode,
      name: item.name,
      category: item.category,
      unit: item.unit,
      price: SafeMath.round(item.price * index, 2),
      district,
      taxStatus: item.taxStatus,
      transportStatus: item.transportStatus,
      observedDate: '2026-10-25', // Immutable historical observation date
      source: `${this.name} (Archived Snapshot)`,
      provenance: 'HISTORICAL_BASELINE'
    }));
  }

  async getFallbackRecords(params = {}) {
    return this.parseDataset(this.immutableBaseline, params);
  }
}
