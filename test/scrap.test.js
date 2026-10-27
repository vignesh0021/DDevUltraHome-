/**
 * Material Rates and Scrap Intelligence Test Suite
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { MaterialPriceIntelligence, TN_DISTRICTS } from '../src/intelligence/materialRates.js';
import { ScrapRatesEngine } from '../src/intelligence/scrapRates.js';
import { ScrapValuationEngine } from '../src/intelligence/scrapValuation.js';

describe('Material Price Intelligence Tests', () => {
  it('loads PWD Schedule of Rates and market benchmarks with valid provenance', () => {
    const rates = MaterialPriceIntelligence.getRatesForDistrict('Chennai');
    assert.ok(rates.length >= 10);

    const cement = rates.find(r => r.category === 'Cement');
    assert.ok(cement);
    assert.strictEqual(cement.sorEffectiveDate, '2025-07-22');
    assert.ok(cement.sorSource.includes('TN PWD'));
    assert.ok(cement.taxStatus.includes('GST'));
    assert.strictEqual(cement.freshness.code, 'VERIFIED_RECENTLY');
  });

  it('adjusts rates across Tamil Nadu districts', () => {
    const chennaiRates = MaterialPriceIntelligence.getRatesForDistrict('Chennai');
    const cbeRates = MaterialPriceIntelligence.getRatesForDistrict('Coimbatore');

    const chennaiSteel = chennaiRates.find(r => r.category === 'Steel');
    const cbeSteel = cbeRates.find(r => r.category === 'Steel');

    assert.strictEqual(chennaiSteel.district, 'Chennai');
    assert.strictEqual(cbeSteel.district, 'Coimbatore');
    assert.ok(cbeSteel.marketPrice >= chennaiSteel.marketPrice); // Coimbatore factor is 1.02
  });

  it('evaluates freshness badges accurately', () => {
    const sorBadge = MaterialPriceIntelligence.getFreshnessBadge('2025-07-22', true);
    assert.strictEqual(sorBadge.code, 'OFFICIAL_SOR');

    const recentBadge = MaterialPriceIntelligence.getFreshnessBadge('2026-10-25', false);
    assert.strictEqual(recentBadge.code, 'VERIFIED_RECENTLY');

    const unverifiedBadge = MaterialPriceIntelligence.getFreshnessBadge(null, false);
    assert.strictEqual(unverifiedBadge.code, 'UNVERIFIED');
  });
});

describe('Scrap Intelligence & Valuation Tests', () => {
  it('retrieves verified LiveChennai and Scraprates benchmarks', () => {
    const all = ScrapRatesEngine.getAllRates();
    assert.ok(all.length >= 10);

    const copper = all.find(s => s.id === 'SCRAP-COP-DC');
    assert.ok(copper);
    assert.strictEqual(copper.indicativeRate, 950.00);
    assert.ok(copper.source.includes('LiveChennai'));

    const iron = all.find(s => s.id === 'SCRAP-IRON-HMS');
    assert.ok(iron);
    assert.strictEqual(iron.indicativeRate, 41.00);
  });

  it('calculates scrap settlement with moisture, tare, and transport deductions', () => {
    // Gross = 1000 kg, Tare = 100 kg => Net scale = 900 kg
    // Moisture 5% = 45 kg => Net accepted = 855 kg
    // Unit rate = ₹41/kg => Gross value = 855 * 41 = ₹35,055
    // Transport = ₹1,500, Labour = ₹500 => Total exp = ₹2,000
    // Net payout = 35,055 - 2,000 = ₹33,055
    const res = ScrapValuationEngine.calculate({
      grossWeight: 1000,
      tareWeight: 100,
      weightUnit: 'kg',
      unitRate: 41.0,
      moisturePercent: 5,
      transportCost: 1500,
      labourHandlingCost: 500
    });

    assert.strictEqual(res.weights.netScaleWeightKg, 900);
    assert.strictEqual(res.weights.netAcceptedWeightKg, 855);
    assert.strictEqual(res.pricing.grossValue, 35055);
    assert.strictEqual(res.pricing.netPayout, 33055);
    assert.strictEqual(res.pricing.formattedNetPayout, '₹ 33,055.00');
  });

  it('handles insulated electrical wire peeling deduction', () => {
    // 100 kg electrical wire with 45% PVC insulation deduction
    // Net accepted copper = 55 kg @ ₹950/kg = ₹52,250
    const res = ScrapValuationEngine.calculate({
      grossWeight: 100,
      tareWeight: 0,
      unitRate: 950.0,
      insulationDeductionPercent: 45
    });

    assert.strictEqual(res.weights.netAcceptedWeightKg, 55);
    assert.strictEqual(res.pricing.grossValue, 52250);
    assert.strictEqual(res.pricing.netPayout, 52250);
  });

  it('rejects invalid tare greater than gross weight', () => {
    assert.throws(() => {
      ScrapValuationEngine.calculate({
        grossWeight: 500,
        tareWeight: 600,
        unitRate: 40
      });
    }, /Tare weight cannot be equal to or greater/);
  });
});
