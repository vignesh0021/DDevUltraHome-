import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProvenanceService,
  provenanceService,
  formatIST,
  computeDataHash,
  FreshnessLevel,
  ProviderStatus,
  DataOrigin
} from '../src/intelligence/provenanceService.js';
import {
  BaseSourceAdapter,
  OfficialSorAdapter,
  PublicMarketAdapter,
  DealerQuotationAdapter,
  ScrapRatesAdapter,
  OfflineBaselineAdapter,
  DETAILED_SCRAP_CATALOG
} from '../src/intelligence/adapters/index.js';

describe('Phase B & C: Provenance Service & Price Adapters', () => {
  describe('ProvenanceService', () => {
    it('formats IST date/time strings accurately with "IST" timezone label', () => {
      const iso = '2026-10-28T09:30:00.000Z';
      const formatted = formatIST(iso);
      assert.ok(formatted.includes('IST'), 'Must contain IST label');
      assert.ok(formatted.includes('2026'), 'Must contain year 2026');
      assert.ok(formatted.includes('15:00') || formatted.includes('3:00') || formatted.includes('03:00'), 'Must convert UTC+5:30');
    });

    it('computes deterministic data hash for objects', () => {
      const h1 = computeDataHash({ item: 'cement', rate: 380 });
      const h2 = computeDataHash({ item: 'cement', rate: 380 });
      const h3 = computeDataHash({ item: 'cement', rate: 385 });
      assert.equal(h1, h2, 'Identical datasets must produce identical hashes');
      assert.notEqual(h1, h3, 'Different datasets must produce different hashes');
      assert.ok(h1.startsWith('h_'));
    });

    it('evaluates freshness dynamically with realistic boundaries', () => {
      const service = new ProvenanceService({
        clock: () => new Date('2026-10-28T12:00:00.000Z')
      });

      // Official SOR: always flagged as official annual benchmark, not stale
      const sorFresh = service.evaluateFreshness('2025-07-22T00:00:00.000Z', true, '2025-07-22T00:00:00.000Z');
      assert.equal(sorFresh.level, FreshnessLevel.OFFICIAL_ANNUAL_SOR);
      assert.equal(sorFresh.isStale, false);

      // Fresh market quote observed 2 hours ago
      const freshQuote = service.evaluateFreshness('2026-10-28T10:00:00.000Z', false);
      assert.equal(freshQuote.level, FreshnessLevel.FRESH);
      assert.equal(freshQuote.isStale, false);

      // Quote observed 40 days ago
      const staleQuote = service.evaluateFreshness('2026-09-10T12:00:00.000Z', false);
      assert.equal(staleQuote.level, FreshnessLevel.STALE);
      assert.equal(staleQuote.isStale, true);

      // Missing observation timestamp
      const unverified = service.evaluateFreshness(null, false);
      assert.equal(unverified.level, FreshnessLevel.UNVERIFIED);
      assert.equal(unverified.isStale, true);
    });

    it('prevents concurrent duplicate refreshes for the same adapter and district', async () => {
      const service = new ProvenanceService();
      let fetchCount = 0;

      const mockAdapter = new (class extends BaseSourceAdapter {
        constructor() {
          super({ id: 'mock_provider', refreshIntervalHours: 1 });
        }
        async checkAvailability() {
          return { available: true };
        }
        async fetchDataset() {
          fetchCount++;
          await new Promise((r) => setTimeout(r, 60));
          return [{ itemCode: 'MOCK', price: 100, unit: 'bag' }];
        }
        async parseDataset(raw) {
          return raw;
        }
      })();

      const [res1, res2] = await Promise.all([
        service.getDatasetWithProvenance(mockAdapter, { district: 'Chennai', forceRefresh: true }),
        service.getDatasetWithProvenance(mockAdapter, { district: 'Chennai', forceRefresh: true })
      ]);

      assert.equal(fetchCount, 1, 'In-flight promise must be reused for concurrent requests');
      assert.equal(res1.success, true);
      assert.equal(res2.success, true);
      assert.equal(res1.records.length, 1);
    });

    it('preserves previous good dataset and marks stale on refresh failure', async () => {
      const service = new ProvenanceService();
      let shouldFail = false;

      const mockAdapter = new (class extends BaseSourceAdapter {
        constructor() {
          super({ id: 'mock_failing_prov', isOfflineOnly: false });
        }
        async checkAvailability() {
          if (shouldFail) return { available: false, reason: 'Network down' };
          return { available: true };
        }
        async fetchDataset() {
          return [{ itemCode: 'CEMENT', price: 380, unit: 'bag' }];
        }
        async parseDataset(raw) {
          return raw;
        }
        async getFallbackRecords() {
          return [{ itemCode: 'CEMENT', price: 380, unit: 'bag' }];
        }
      })();

      // 1. Initial successful retrieval
      const initial = await service.getDatasetWithProvenance(mockAdapter, { district: 'Chennai' });
      assert.equal(initial.success, true);
      assert.equal(initial.records[0].price, 380);

      // 2. Subsequent failure
      shouldFail = true;
      const failed = await service.getDatasetWithProvenance(mockAdapter, { district: 'Chennai', forceRefresh: true });
      assert.equal(failed.success, false);
      assert.equal(failed.records[0].price, 380, 'Must preserve previous good dataset');
      assert.equal(failed.metadata.isStale, true);
      assert.equal(failed.metadata.providerStatus, ProviderStatus.STALE);
      assert.ok(failed.metadata.errorMessage.includes('Network down'));
    });
  });

  describe('OfficialSorAdapter', () => {
    it('provides TN PWD SOR as official annual document and never claims to be daily spot rate', async () => {
      const adapter = new OfficialSorAdapter();
      const meta = adapter.getSourceMetadata();
      assert.equal(meta.type, 'OFFICIAL_SOR');
      assert.equal(meta.isOfficialSor, true);
      assert.equal(meta.effectiveFinancialYear, '2025–2026');

      const raw = await adapter.fetchDataset({ district: 'Chennai' });
      assert.ok(raw.length > 0);
      const parsed = await adapter.parseDataset(raw, { district: 'Chennai' });
      const cement = parsed.find((r) => r.itemCode === 'M-0001-A' || r.name.includes('OPC 53'));
      assert.ok(cement, 'OPC 53 Cement record must exist');
      assert.equal(cement.price, 320);
      assert.equal(cement.department, 'Public Works Department, Government of Tamil Nadu');
      assert.ok(cement.scheduleVersion.includes('2025–2026'));
    });
  });

  describe('PublicMarketAdapter', () => {
    it('detects rate outliers and validates positive prices', () => {
      const adapter = new PublicMarketAdapter();

      // Normal records
      const validRecords = [
        { itemCode: 'MAT-CEM-OPC53', price: 410, unit: 'bag' },
        { itemCode: 'MAT-STL-FE550D', price: 62, unit: 'kg' }
      ];
      assert.equal(adapter.validateDataset(validRecords).valid, true);

      // Outlier records (> 500,000 threshold requires review)
      const anomalyRecords = [
        { itemCode: 'MAT-CEM-OPC53', price: 600000, unit: 'bag' }
      ];
      const validation = adapter.validateDataset(anomalyRecords);
      assert.ok(validation.warnings.some((w) => w.includes('requires engineering review')));

      // Zero or negative price error
      const invalidRecords = [
        { itemCode: 'MAT-CEM-OPC53', price: -5, unit: 'bag' }
      ];
      assert.equal(adapter.validateDataset(invalidRecords).valid, false);
    });
  });

  describe('DealerQuotationAdapter', () => {
    it('validates dealer quotation constraints and parses CSV bulk import', () => {
      const adapter = new DealerQuotationAdapter();

      // Valid single quote
      const added = adapter.addQuotation({
        supplierName: 'Guindy Steel Trading Co',
        supplierGstin: '33AABCG1234F1Z0',
        district: 'Chennai',
        itemCode: 'MAT-STL-FE550D',
        standardName: 'TMT Steel Fe550D',
        price: 61000,
        unit: 'Tonne'
      });
      assert.ok(added.id.startsWith('Q-'));
      assert.equal(added.supplierName, 'Guindy Steel Trading Co');

      // CSV bulk import
      const csv = `SupplierName,SupplierGstin,District,ItemCode,StandardName,Grade,Unit,Price,TaxStatus,TransportTerms,ValidityUntil
Madurai Cements,33AAACM9876P1Z3,Madurai,MAT-CEM-OPC53,OPC 53 Cement,Grade 53,Bag,405,Inclusive GST,Ex-Godown,2026-12-31T00:00:00.000Z
Salem Aggregates,33AAACS5544Q1Z1,Salem,MAT-SND-MSAND,M-Sand,Zone II,TN Unit,3800,Exclusive GST,Site Delivery,2026-12-31T00:00:00.000Z`;

      const result = adapter.importFromCsv(csv);
      assert.equal(result.success, true);
      assert.equal(result.imported, 2);
      assert.equal(result.errors.length, 0);
    });
  });

  describe('ScrapRatesAdapter', () => {
    it('provides verifiable alloy sub-grades and statutory hazard flags', async () => {
      const adapter = new ScrapRatesAdapter();
      const catalog = await adapter.fetchDataset();
      assert.ok(catalog.length >= 10, 'Should cover detailed alloy subgrades');

      const leadBattery = catalog.find((r) => r.id === 'SCR-BAT-LEAD');
      assert.ok(leadBattery, 'Lead acid battery scrap must exist');
      assert.equal(leadBattery.isHazardous, true);
      assert.equal(leadBattery.hazardWorkflow, 'HAZARDOUS_ACID_REGULATED');
      assert.ok(leadBattery.complianceNote.includes('TNPCB Form 8'));

      const berryCopper = catalog.find((r) => r.id === 'SCR-COP-BERRY');
      assert.ok(berryCopper);
      assert.equal(berryCopper.alloyGrade, 'Grade A 99.9% Electrolytic Copper');
      assert.equal(berryCopper.unit, 'kg');

      const honeyBrass = catalog.find((r) => r.id === 'SCR-BRS-HONEY');
      assert.ok(honeyBrass);
      assert.equal(honeyBrass.alloyGrade, 'Yellow Brass CuZn40');
    });
  });

  describe('OfflineBaselineAdapter', () => {
    it('maintains immutable baseline date stamped 2026-10-25 and does not advance with system clock', async () => {
      const adapter = new OfflineBaselineAdapter();
      const meta = adapter.getSourceMetadata();
      assert.equal(meta.sourceObservedAt, '2026-10-25T00:00:00.000Z');
      assert.equal(adapter.isOfflineOnly, true);
      assert.equal(adapter.type, 'HISTORICAL_BASELINE');

      const records = await adapter.fetchDataset({ district: 'Madurai' });
      assert.ok(records.length > 0);
      assert.ok(records.every((r) => r.observedDate === '2026-10-25'));
    });
  });
});
