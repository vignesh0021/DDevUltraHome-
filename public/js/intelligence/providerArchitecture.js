/**
 * DDevUltraHome — Free & Low-Cost Price Provider Architecture
 * Supports TN PWD SOR, Dealer Quotations, Public Free APIs, Custom Endpoints & Offline Baseline
 * Powered by centralized ProvenanceService and pluggable Source Adapters.
 */

import { SafeMath } from '../engine/math.js';
import { defaultProvenanceService, ProviderStatus, DataOrigin, FreshnessLevel } from './provenanceService.js';
import {
  OfficialSorAdapter,
  PublicMarketAdapter,
  DealerQuotationAdapter,
  ScrapRatesAdapter,
  OfflineBaselineAdapter
} from './adapters/index.js';

export { ProviderStatus, DataOrigin, FreshnessLevel };

export const PriceProvenance = {
  OFFICIAL_PWD_SOR: 'OFFICIAL_PWD_SOR',
  DEALER_QUOTATION: 'DEALER_QUOTATION',
  VERIFIED_PUBLIC_API: 'VERIFIED_PUBLIC_API',
  USER_ENTERED: 'USER_ENTERED',
  HISTORICAL_BASELINE: 'HISTORICAL_BASELINE'
};

// Backwards-compatible class exports
export class OfficialPwdSorProvider extends OfficialSorAdapter {}
export class DealerQuotationProvider extends DealerQuotationAdapter {}
export class PublicApiProvider extends PublicMarketAdapter {
  constructor(endpointUrl = '') {
    super({ id: 'public_api', name: 'Public Commodity API / Custom Endpoint', sourceUrl: endpointUrl });
    this.endpointUrl = endpointUrl;
  }
  setEndpoint(url) {
    this.sourceUrl = url ? url.trim() : '';
    this.endpointUrl = this.sourceUrl;
  }
}
export class OfflineReferenceProvider extends OfflineBaselineAdapter {}

/**
 * Enterprise Provider Registry managing adapter lifecycle and provenance
 */
export class PriceProviderRegistry {
  constructor(provenanceService = defaultProvenanceService) {
    this.provenance = provenanceService;
    this.adapters = {
      pwd_sor: new OfficialSorAdapter(),
      dealer_quote: new DealerQuotationAdapter(),
      public_api: new PublicApiProvider(),
      offline_reference: new OfflineBaselineAdapter()
    };
    this.scrapAdapter = new ScrapRatesAdapter();
    this.activeProviderId = 'dealer_quote';
    this.customOverrides = {};
    this.loadCustomOverrides();
  }

  loadCustomOverrides() {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('ddev_custom_rates');
        if (raw) this.customOverrides = JSON.parse(raw);
      } catch {}
    }
  }

  /**
   * Return catalog of configured providers with real availability and provenance
   */
  getProviders() {
    return Object.values(this.adapters).map(adapter => {
      const cached = this.provenance.cache.get(`${adapter.id}_Chennai`);
      const meta = cached?.metadata;
      return {
        id: adapter.id,
        name: adapter.name,
        type: adapter.type,
        status: meta?.providerStatus || (adapter.isOfflineOnly ? ProviderStatus.HISTORICAL_BASELINE : ProviderStatus.OFFLINE),
        isOfficialSor: adapter.isOfficialSor,
        isOfflineOnly: adapter.isOfflineOnly,
        sourceUrl: adapter.sourceUrl,
        lastAttemptAt: meta?.lastAttemptAt || null,
        lastSuccessfulFetchAt: meta?.lastSuccessfulFetchAt || null,
        sourceObservedAt: meta?.sourceObservedAt || adapter.sourceObservedAt,
        isActive: adapter.id === this.activeProviderId
      };
    });
  }

  getActiveAdapter() {
    return this.adapters[this.activeProviderId] || this.adapters.dealer_quote;
  }

  setActiveProvider(providerId) {
    if (this.adapters[providerId]) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  setCustomEndpoint(url) {
    if (this.adapters.public_api) {
      this.adapters.public_api.setEndpoint(url);
    }
  }

  /**
   * Perform genuine network check against active provider
   */
  async testActiveConnection() {
    const adapter = this.getActiveAdapter();
    const start = Date.now();
    try {
      const res = await adapter.checkAvailability();
      const latencyMs = res.latencyMs !== undefined ? res.latencyMs : (Date.now() - start);
      return {
        ok: res.available,
        latencyMs,
        message: res.reason || (res.available ? 'Provider connected' : 'Provider unreachable'),
        providerId: adapter.id,
        isOfficialSor: adapter.isOfficialSor
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: `Connection failed: ${err.message}`,
        providerId: adapter.id
      };
    }
  }

  /**
   * Retrieve material rates customized for district with full data provenance
   */
  async getRates(district = 'Chennai', forceRefresh = false) {
    const adapter = this.getActiveAdapter();
    const result = await this.provenance.getDatasetWithProvenance(adapter, { district, forceRefresh });

    // Determine default provenance tag according to active provider
    let defaultProvenance = PriceProvenance.DEALER_QUOTATION;
    if (adapter.isOfficialSor) defaultProvenance = PriceProvenance.OFFICIAL_PWD_SOR;
    else if (adapter.id === 'public_api') defaultProvenance = PriceProvenance.VERIFIED_PUBLIC_API;
    else if (adapter.isOfflineOnly) defaultProvenance = PriceProvenance.HISTORICAL_BASELINE;

    // Apply user custom overrides if any
    const items = result.records.map(item => {
      const overrideKey = item.itemCode || item.id;
      if (this.customOverrides[overrideKey]) {
        return {
          ...item,
          provenance: PriceProvenance.USER_ENTERED,
          price: this.customOverrides[overrideKey].price,
          source: 'User Custom Rate (Manual Override)',
          isCustom: true
        };
      }
      return {
        ...item,
        provenance: item.provenance || defaultProvenance
      };
    });

    items.metadata = result.metadata;
    items.records = items;
    items.items = items;
    items.success = result.success;
    return items;
  }

  /**
   * Retrieve scrap rates with verified alloy sub-grades and compliance flags
   */
  async getScrapRates(forceRefresh = false) {
    const adapter = this.scrapAdapter;
    const result = await this.provenance.getDatasetWithProvenance(adapter, { forceRefresh });
    const items = [...result.records];
    items.metadata = result.metadata;
    items.records = items;
    items.items = items;
    items.success = result.success;
    return items;
  }

  flushCache() {
    this.customOverrides = {};
    this.provenance.clearCache();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('ddev_custom_rates');
      } catch {}
    }
    return { ok: true, message: 'Local price cache and custom rates cleared successfully' };
  }

  exportCustomRates() {
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      activeProvider: this.activeProviderId,
      customOverrides: this.customOverrides
    }, null, 2);
  }

  importCustomRates(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.customOverrides && typeof data.customOverrides === 'object') {
        this.customOverrides = { ...this.customOverrides, ...data.customOverrides };
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('ddev_custom_rates', JSON.stringify(this.customOverrides));
          } catch {}
        }
        return { ok: true, count: Object.keys(data.customOverrides).length };
      }
      throw new Error('Invalid custom rates JSON format');
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export const defaultProviderRegistry = new PriceProviderRegistry();
