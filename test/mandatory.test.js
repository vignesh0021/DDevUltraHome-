/**
 * Mandatory Civil Engineering Standards Test Suite
 * Covers Geotech SBC Footing, Concrete Cube QC, TNCDBR 2019, M-Book RA Billing, Anti-Termite
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';

import { GeotechEngine, TN_SOIL_SBC_BENCHMARKS } from '../src/engine/geotech.js';
import { ConcreteQcEngine } from '../src/engine/qc.js';
import { TncdbrEngine } from '../src/engine/tncdbr.js';
import { MBookEngine } from '../src/engine/mbook.js';
import { AntiTermiteEngine } from '../src/engine/antitermite.js';

describe('1. Geotechnical & SBC Footing Sizing (IS 1904 / IS 6403)', () => {
  it('sizes isolated footing from 600 kN column axial load on Chennai clay (SBC 150 kN/m²)', () => {
    const res = GeotechEngine.sizeFooting({
      columnAxialLoadKn: 600,
      sbcKnm2: 150,
      columnWidthMm: 300,
      columnDepthMm: 300,
      concreteGrade: 'M20',
      steelGrade: 'Fe500'
    });

    // Load with 10% self-weight = 660 kN => Required area = 660 / 150 = 4.40 m²
    // Square side ≈ sqrt(4.4) ≈ 2.09m => rounded up to 2.1m (Area = 4.41 m²)
    assert.strictEqual(res.isSafe, true);
    assert.ok(res.footingDimensions.lengthM >= 2.1);
    assert.ok(res.footingDimensions.overallDepthMm >= 350);
    assert.strictEqual(res.footingDimensions.clearCoverMm, 50);
    assert.ok(res.reinforcement.barsCountEachWay >= 6);
  });

  it('rejects zero or negative column load', () => {
    assert.throws(() => GeotechEngine.sizeFooting({ columnAxialLoadKn: 0 }), /greater than 0/);
    assert.throws(() => GeotechEngine.sizeFooting({ columnAxialLoadKn: -100 }), /greater than 0/);
  });
});

describe('2. Concrete Cube Compressive Strength Test QC (IS 516 / IS 456)', () => {
  it('evaluates M20 28-day batch passing criteria with 3 specimen cubes', () => {
    // 3 cubes with breaking loads 470 kN, 490 kN, 480 kN
    // Strength: (480 * 1000) / 22500 = 21.33 N/mm² (exceeds M20 target 20 N/mm²)
    const res = ConcreteQcEngine.evaluateBatch({
      grade: 'M20',
      testAgeDays: 28,
      breakingLoadsKn: [470, 490, 480],
      elementName: 'First Floor Roof Slab'
    });

    assert.strictEqual(res.resultStatus, 'PASS');
    assert.strictEqual(res.isStrengthAchieved, true);
    assert.strictEqual(res.isVariationWithin15Percent, true);
    assert.ok(res.averageStrengthNmm2 >= 20.0);
  });

  it('flags batch failure when compressive strength is below target', () => {
    // Breaking loads 300, 310, 305 => Average strength ≈ 13.5 N/mm² (below 28-day target of 20 N/mm²)
    const res = ConcreteQcEngine.evaluateBatch({
      grade: 'M20',
      testAgeDays: 28,
      breakingLoadsKn: [300, 310, 305]
    });

    assert.strictEqual(res.resultStatus, 'FAIL');
    assert.strictEqual(res.isStrengthAchieved, false);
  });
});

describe('3. TNCDBR 2019 Building Rules & Setback Validator', () => {
  it('validates compliant G+1 residential plan in Chennai (1 Ground / 2400 sq.ft)', () => {
    const res = TncdbrEngine.validateResidentialPlan({
      plotAreaSqft: 2400,
      roadWidthM: 9.14, // 30 ft road
      proposedGroundFloorSqft: 1400, // 58.3% coverage (< 70%)
      proposedTotalBuiltupSqft: 2600, // FSI = 1.08 (< 1.75 allowed)
      buildingHeightM: 7.0,
      frontSetbackM: 3.0,
      rearSetbackM: 1.5,
      side1SetbackM: 1.0,
      side2SetbackM: 1.0
    });

    assert.strictEqual(res.isCompliant, true);
    assert.strictEqual(res.status, 'APPROVED_COMPLIANT');
    assert.strictEqual(res.metrics.plotCoverage.isPass, true);
    assert.strictEqual(res.metrics.fsi.isPass, true);
  });

  it('detects plot coverage and FSI violations', () => {
    const res = TncdbrEngine.validateResidentialPlan({
      plotAreaSqft: 2400,
      roadWidthM: 7.0,
      proposedGroundFloorSqft: 2000, // 83.3% (> 70% limit)
      proposedTotalBuiltupSqft: 4000, // FSI = 1.67 (> 1.50 limit for 7m road)
      frontSetbackM: 1.0 // < 1.5m min
    });

    assert.strictEqual(res.isCompliant, false);
    assert.ok(res.violations.length >= 2);
  });
});

describe('4. Site Measurement Book (M-Book) & RA Billing', () => {
  it('computes exact M-Book item quantities from multi-line entries', () => {
    const res = MBookEngine.calculateItemQuantity([
      { location: 'Outer Wall Grid A-B', nos: 2, lengthM: 6.0, breadthM: 0.23, depthM: 3.0 }, // 2 * 6 * 0.23 * 3 = 8.28 m³
      { location: 'Inner Partition Wall', nos: 3, lengthM: 4.0, breadthM: 0.115, depthM: 3.0 } // 3 * 4 * 0.115 * 3 = 4.14 m³
    ]);

    assert.strictEqual(res.totalQuantity, 12.42); // 8.28 + 4.14
  });

  it('generates RA bill with 5% retention, 1% TDS, and 1% labour cess', () => {
    // Current period work: 100 m³ @ ₹4,500 = ₹450,000
    // Deductions: 5% retention (22,500) + 1% TDS (4,500) + 1% Cess (4,500) = 31,500
    // Net payable = 450,000 - 31,500 = ₹418,500
    const bill = MBookEngine.generateRaBill({
      billNumber: 'RA Bill No. 2',
      previousGrossCertified: 200000,
      billItems: [
        { description: 'RCC M20 Casting', quantitySinceLastBill: 100, unit: 'm³', rate: 4500 }
      ],
      retentionPercent: 5.0,
      tdsPercent: 1.0,
      labourCessPercent: 1.0
    });

    assert.strictEqual(bill.financials.currentBillGrossValue, 450000);
    assert.strictEqual(bill.financials.cumulativeGrossValueToDate, 650000);
    assert.strictEqual(bill.financials.deductions.retentionMoney.amount, 22500);
    assert.strictEqual(bill.financials.deductions.tdsSec194C.amount, 4500);
    assert.strictEqual(bill.financials.deductions.totalDeductions, 31500);
    assert.strictEqual(bill.financials.netPayableToContractor, 418500);
    assert.strictEqual(bill.financials.formattedNetPayable, '₹ 4,18,500.00');
  });
});

describe('5. Anti-Termite Pre-Construction Treatment (IS 6313)', () => {
  it('calculates 4-stage chemical and water emulsion requirements', () => {
    const res = AntiTermiteEngine.calculate({
      plinthAreaM2: 100,
      perimeterM: 40,
      trenchAreaM2: 60,
      chemical: 'CHLORPYRIFOS_20EC'
    });

    // Stage 1 (Trench): 60 * 5 = 300 L
    // Stage 2 (Backfill): 40 * 7.5 = 300 L
    // Stage 3 (Plinth bed): 100 * 5 = 500 L
    // Stage 4 (Perimeter): 40 * 7.5 = 300 L
    // Total emulsion = 1400 Litres
    // Chemical (1:19 dilution => total 20 parts): 1400 / 20 = 70 Litres (~14 cans of 5L)
    // Water = 1330 Litres
    assert.strictEqual(res.totalEmulsionLitres, 1400);
    assert.strictEqual(res.concentratedChemicalLitres, 70);
    assert.strictEqual(res.cans5LitreRequired, 14);
    assert.strictEqual(res.waterLitresRequired, 1330);
  });
});
