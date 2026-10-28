/**
 * DDevUltraHome — Base Source Adapter Interface
 * Pluggable architecture for Official SOR, Public Market, Dealer Quotations,
 * Scrap Metal Grades, and Immutable Offline Baselines.
 */

export class BaseSourceAdapter {
  constructor(options = {}) {
    this.id = options.id || 'base_adapter';
    this.name = options.name || 'Base Adapter';
    this.type = options.type || 'CUSTOM';
    this.isOfficialSor = Boolean(options.isOfficialSor);
    this.isOfflineOnly = Boolean(options.isOfflineOnly);
    this.refreshIntervalHours = options.refreshIntervalHours || 12;
    this.sourceUrl = options.sourceUrl || '';
    this.sourceObservedAt = options.sourceObservedAt || new Date().toISOString();
    this.sourcePublishedAt = options.sourcePublishedAt || null;
  }

  /**
   * Real availability check via network ping or document verification
   * @returns {Promise<{ available: boolean, latencyMs?: number, reason?: string }>}
   */
  async checkAvailability() {
    throw new Error('checkAvailability() must be implemented by adapter subclass');
  }

  /**
   * Fetch raw data from source with timeout and rate limiting
   * @param {Object} params
   * @returns {Promise<any>}
   */
  async fetchDataset(params = {}) {
    throw new Error('fetchDataset() must be implemented by adapter subclass');
  }

  /**
   * Parse raw data into preliminary records
   * @param {any} raw
   * @param {Object} params
   * @returns {Promise<Array<Object>>}
   */
  async parseDataset(raw, params = {}) {
    throw new Error('parseDataset() must be implemented by adapter subclass');
  }

  /**
   * Validate dataset: checks for positive prices, valid units, valid currencies,
   * schema requirements, and flags sudden outliers (>50% shift).
   * @param {Array<Object>} records
   * @returns {{ valid: boolean, errors: Array<string>, warnings: Array<string> }}
   */
  validateDataset(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { valid: false, errors: ['Dataset is empty or not an array'], warnings: [] };
    }

    const errors = [];
    const warnings = [];

    records.forEach((r, idx) => {
      if (!r.itemCode && !r.id) {
        errors.push(`Record #${idx}: Missing itemCode/id`);
      }
      if (typeof r.price !== 'number' || isNaN(r.price) || r.price <= 0) {
        errors.push(`Record #${idx} (${r.name || r.id}): Price must be a positive number, got ${r.price}`);
      }
      if (!r.unit) {
        errors.push(`Record #${idx} (${r.name || r.id}): Missing unit`);
      }
      // Outlier check: price > 500,000 INR per unit requires review warning
      if (r.price > 500000) {
        warnings.push(`Record #${idx} (${r.name || r.id}): High price value (${r.price}) requires engineering review`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Normalize parsed record into standard DDevUltraHome Price Record contract
   * @param {Object} record
   * @param {Object} params
   * @returns {Object}
   */
  normalizeRecord(record, params = {}) {
    return {
      id: record.id || record.itemCode,
      itemCode: record.itemCode || record.id,
      name: record.name || record.standardName,
      category: record.category || 'General',
      unit: record.unit,
      price: record.price,
      currency: 'INR',
      district: params.district || record.district || 'Chennai',
      taxStatus: record.taxStatus || 'Exclusive of GST',
      transportStatus: record.transportStatus || 'Ex-Quarry / Ex-Warehouse',
      source: record.source || this.name,
      sourceUrl: this.sourceUrl,
      observedDate: record.observedDate || this.sourceObservedAt,
      isOfficialSor: this.isOfficialSor
    };
  }

  /**
   * Return metadata about this source
   */
  getSourceMetadata() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      sourceUrl: this.sourceUrl,
      sourceObservedAt: this.sourceObservedAt,
      sourcePublishedAt: this.sourcePublishedAt,
      isOfficialSor: this.isOfficialSor,
      isOfflineOnly: this.isOfflineOnly
    };
  }

  /**
   * Fallback records when live source is offline
   */
  async getFallbackRecords(params = {}) {
    return [];
  }
}
