/**
 * Comprehensive Independent Verification Test Suite
 * Covers Core Math, Unit Conversions, Concrete, RCC, Masonry, Finishing, Earthwork, Water Tank
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';

import { SafeMath, UnitConverter, Validator } from '../src/engine/math.js';
import { ConcreteEngine, CONSTANTS, CONCRETE_MIX_PROPORTIONS } from '../src/engine/concrete.js';
import { RccEngine } from '../src/engine/rcc.js';
import { MasonryEngine, BRICK_TYPES } from '../src/engine/masonry.js';
import { FinishingEngine } from '../src/engine/finishing.js';
import { EarthworkEngine } from '../src/engine/earthwork.js';
import { WaterTankEngine } from '../src/engine/watertank.js';
import { LabourEngine } from '../src/engine/labour.js';
import { BoqEngine } from '../src/engine/boq.js';
import { WastageEngine } from '../src/engine/wastage.js';

describe('1. Decimal-Safe Math & Unit Conversions', () => {
  it('handles floating point additions safely without precision bugs', () => {
    assert.strictEqual(SafeMath.add(0.1, 0.2), 0.3);
    assert.strictEqual(SafeMath.sub(1.0, 0.9), 0.1);
    assert.strictEqual(SafeMath.mul(10.55, 3), 31.65);
    assert.strictEqual(SafeMath.div(100, 3, 2), 33.33);
  });

  it('throws on division by zero', () => {
    assert.throws(() => SafeMath.div(50, 0), /Division by zero/);
  });

  it('formats Indian numbering system correctly', () => {
    assert.strictEqual(SafeMath.formatINR(1500), '₹ 1,500.00');
    assert.strictEqual(SafeMath.formatINR(150000), '₹ 1,50,000.00');
    assert.strictEqual(SafeMath.formatINR(12345678.90), '₹ 1,23,45,678.90');
    assert.strictEqual(SafeMath.formatINR(-5000), '-₹ 5,000.00');
  });

  it('converts Tamil Nadu land units accurately', () => {
    // 1 Ground = 2400 sq.ft
    const groundInSqft = UnitConverter.convertArea(1, 'ground', 'sqft');
    assert.strictEqual(SafeMath.round(groundInSqft, 1), 2400);

    // 1 Cent = 435.6 sq.ft
    const centInSqft = UnitConverter.convertArea(1, 'cent', 'sqft');
    assert.strictEqual(SafeMath.round(centInSqft, 1), 435.6);

    // 1 Acre = 100 Cents
    const acreInCents = UnitConverter.convertArea(1, 'acre', 'cent');
    assert.strictEqual(SafeMath.round(acreInCents, 0), 100);

    // 1 TN Unit of Sand = 100 cft
    const unitInCft = UnitConverter.convertVolume(1, 'unit', 'cft');
    assert.strictEqual(SafeMath.round(unitInCft, 0), 100);
  });

  it('validates boundaries and rejects negative values', () => {
    assert.strictEqual(Validator.positiveNumber('Span', 5).valid, true);
    assert.strictEqual(Validator.positiveNumber('Span', -5).valid, false);
    assert.strictEqual(Validator.positiveNumber('Span', 0, false).valid, false);
    assert.strictEqual(Validator.positiveNumber('Span', 0, true).valid, true);
    assert.strictEqual(Validator.positiveNumber('Span', 'abc').valid, false);
  });
});

describe('2. Concrete Mix Estimation Engine', () => {
  it('calculates M20 (1:1.5:3) constituents for 10 m³ accurately', () => {
    const res = ConcreteEngine.calculate({
      volumeM3: 10,
      mixGrade: 'M20',
      dryFactor: 1.54,
      wastagePercent: 0
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.wetVolumeM3, 10);
    assert.strictEqual(res.dryVolumeM3, 15.4); // 10 * 1.54

    // Ratio 1 + 1.5 + 3 = 5.5
    // Cement = (1 / 5.5) * 15.4 = 2.8 m³
    // Cement kg = 2.8 * 1440 = 4032 kg
    // Cement bags = 4032 / 50 = 80.64 bags
    assert.strictEqual(res.materials.cement.volumeM3, 2.8);
    assert.strictEqual(res.materials.cement.weightKg, 4032);
    assert.strictEqual(res.materials.cement.bags, 80.64);
    assert.strictEqual(res.materials.cement.bagsRounded, 81);

    // Sand = (1.5 / 5.5) * 15.4 = 4.2 m³
    assert.strictEqual(res.materials.sand.volumeM3, 4.2);
    assert.strictEqual(res.materials.sand.volumeCft, SafeMath.round(4.2 * CONSTANTS.CFT_PER_M3, 2));

    // Aggregate = (3 / 5.5) * 15.4 = 8.4 m³
    assert.strictEqual(res.materials.aggregate.volumeM3, 8.4);
    assert.strictEqual(res.materials.aggregate.volumeCft, SafeMath.round(8.4 * CONSTANTS.CFT_PER_M3, 2));
  });

  it('rejects invalid or zero concrete volume', () => {
    assert.throws(() => ConcreteEngine.calculate({ volumeM3: 0 }), /greater than 0/);
    assert.throws(() => ConcreteEngine.calculate({ volumeM3: -10 }), /greater than 0/);
  });
});

describe('3. RCC Structural Elements Engine', () => {
  it('correctly categorizes one-way vs two-way slab and estimates quantities', () => {
    // 6m x 2m slab => Ly/Lx = 3 > 2 => One-Way Slab
    const oneWay = RccEngine.calculateSlab({
      length: 6,
      width: 2,
      thickness: 125,
      thicknessUnit: 'mm'
    });
    assert.strictEqual(oneWay.slabType, 'One-Way Slab (Ly/Lx > 2)');
    assert.strictEqual(oneWay.concreteVolumeM3, 1.5); // 6 * 2 * 0.125
    assert.strictEqual(oneWay.steel.percentage, 0.8);
    assert.ok(oneWay.steel.weightKg > 0);

    // 4m x 4m slab => Ly/Lx = 1 <= 2 => Two-Way Slab
    const twoWay = RccEngine.calculateSlab({
      length: 4,
      width: 4,
      thickness: 150,
      thicknessUnit: 'mm'
    });
    assert.strictEqual(twoWay.slabType, 'Two-Way Slab (Ly/Lx <= 2)');
    assert.strictEqual(twoWay.concreteVolumeM3, 2.4); // 4 * 4 * 0.150
  });

  it('calculates RCC beam concrete, shuttering, and steel', () => {
    const beam = RccEngine.calculateBeam({
      span: 4.5,
      width: 230,
      depth: 450,
      count: 2,
      dimensionUnit: 'mm'
    });
    assert.strictEqual(beam.count, 2);
    // Single volume = 4.5 * 0.230 * 0.450 = 0.46575 m³ => Total = 0.9315 m³
    assert.strictEqual(beam.concreteVolumeM3, 0.9315);
    assert.ok(beam.shutteringAreaM2 > 0);
    assert.ok(beam.steel.weightKg > 0);
  });

  it('calculates RCC column quantities accurately', () => {
    const col = RccEngine.calculateColumn({
      height: 3.0,
      width: 230,
      depth: 300,
      count: 4
    });
    assert.strictEqual(col.count, 4);
    // Single volume = 3.0 * 0.23 * 0.30 = 0.207 m³ => Total = 0.828 m³
    assert.strictEqual(col.concreteVolumeM3, 0.828);
    // Perimeter = 2*(0.23+0.30) = 1.06m => single shuttering = 1.06 * 3.0 = 3.18 m² => total 4 * 3.18 = 12.72 m²
    assert.strictEqual(col.shutteringAreaM2, 12.72);
  });

  it('calculates isolated footing and PCC bed quantities', () => {
    const footing = RccEngine.calculateFooting({
      length: 1.5,
      width: 1.5,
      depth: 450, // mm
      pccBedThicknessMm: 100,
      pccOffsetMm: 100,
      count: 1
    });
    // RCC volume = 1.5 * 1.5 * 0.45 = 1.0125 m³
    assert.strictEqual(footing.rccVolumeM3, 1.0125);
    // PCC bed = (1.5 + 0.2) * (1.5 + 0.2) * 0.1 = 1.7 * 1.7 * 0.1 = 0.289 m³
    assert.strictEqual(footing.pccVolumeM3, 0.289);
  });
});

describe('4. Masonry Engine', () => {
  it('calculates Tamil Nadu traditional country brick requirement with deductions', () => {
    const res = MasonryEngine.calculate({
      wallLength: 5,
      wallHeight: 3,
      wallThicknessMm: 230,
      brickType: 'TRADITIONAL_TN_BRICK',
      mortarMix: '1:5',
      deductions: [{ width: 1.0, height: 2.1, count: 1 }] // 1 door opening 2.1 m²
    });

    // Gross area = 5 * 3 = 15 m²
    // Deduction = 2.1 m² => Net area = 12.9 m²
    // Net volume = 12.9 * 0.230 = 2.967 m³
    assert.strictEqual(res.netAreaM2, 12.9);
    assert.strictEqual(res.netVolumeM3, 2.967);
    assert.ok(res.materials.bricks.countRequired > 0);
    assert.ok(res.materials.cement.bagsRounded > 0);
    assert.ok(res.materials.sand.volumeCft > 0);
  });

  it('calculates AAC block masonry for partition walls', () => {
    const res = MasonryEngine.calculate({
      wallLength: 4,
      wallHeight: 3,
      wallThicknessMm: 100,
      brickType: 'AAC_BLOCK_100',
      mortarMix: '1:4'
    });
    assert.strictEqual(res.netAreaM2, 12);
    assert.strictEqual(res.netVolumeM3, 1.2);
    assert.ok(res.materials.bricks.countRequired > 0);
  });
});

describe('5. Finishing Works Engine', () => {
  it('calculates 12mm internal plastering cement and sand', () => {
    const res = FinishingEngine.calculatePlaster({
      areaM2: 100,
      spec: 'INTERNAL_12MM_1:5'
    });
    assert.strictEqual(res.areaM2, 100);
    assert.ok(res.dryVolumeM3 > 0);
    assert.ok(res.materials.cement.bagsRounded > 0);
    assert.ok(res.materials.sand.volumeCft > 0);
  });

  it('calculates painting materials for interior surfaces', () => {
    const res = FinishingEngine.calculatePainting({
      wallAreaM2: 50,
      includePutty: true,
      includePrimer: true,
      includeEmulsion: true
    });
    assert.strictEqual(res.areaM2, 50);
    assert.ok(res.materials.putty.weightKg > 0);
    assert.ok(res.materials.primer.litres > 0);
    assert.ok(res.materials.paint.litres > 0);
  });

  it('calculates 2x2 vitrified tiles and bedding mortar', () => {
    const res = FinishingEngine.calculateFlooring({
      floorAreaM2: 25,
      perimeterM: 20,
      tileType: 'VITRIFIED_2X2'
    });
    assert.strictEqual(res.areas.floorAreaM2, 25);
    assert.strictEqual(res.areas.skirtingAreaM2, 2); // 20 * 0.10
    assert.strictEqual(res.areas.totalAreaM2, 27);
    assert.ok(res.tiles.countRequired > 0);
    assert.ok(res.beddingMaterials.cement.totalBagsRounded > 0);
  });
});

describe('6. Earthwork & Water Tank Engines', () => {
  it('calculates excavation and backfilling with swelling factors', () => {
    const res = EarthworkEngine.calculate({
      length: 2,
      width: 2,
      depth: 1.5,
      count: 4,
      bulkingFactor: 1.25,
      structureVolumeM3: 4.0
    });
    // In-situ volume = 2 * 2 * 1.5 * 4 = 24 m³
    assert.strictEqual(res.inSituExcavationM3, 24);
    // Loose volume = 24 * 1.25 = 30 m³
    assert.strictEqual(res.looseExcavatedM3, 30);
    assert.ok(res.backfill.pitBackfillM3 > 0);
  });

  it('calculates water tank capacity and freeboard accurately', () => {
    const res = WaterTankEngine.calculateCapacity({
      shape: 'RECTANGULAR',
      lengthM: 3,
      widthM: 2,
      heightM: 2,
      freeboardM: 0.20
    });
    // Gross volume = 3 * 2 * 2 = 12 m³ = 12,000 Litres
    assert.strictEqual(res.grossVolumeM3, 12);
    assert.strictEqual(res.grossCapacityLitres, 12000);
    // Effective water depth = 2 - 0.20 = 1.8m => Net volume = 3 * 2 * 1.8 = 10.8 m³ = 10,800 Litres
    assert.strictEqual(res.netWaterVolumeM3, 10.8);
    assert.strictEqual(res.netCapacityLitres, 10800);
  });

  it('estimates residential water demand per IS 1172', () => {
    const res = WaterTankEngine.estimateDemandAndSize({
      numberOfOccupants: 5,
      lpcd: 135,
      storageDays: 2
    });
    // 5 * 135 = 675 L/day => 2 days = 1350 L
    assert.strictEqual(res.dailyDemandLitres, 675);
    assert.strictEqual(res.totalStorageLitres, 1350);
  });
});

describe('7. Labour & BOQ Engines', () => {
  it('computes labour man-days based on Tamil Nadu PWD norms', () => {
    const res = LabourEngine.calculate({
      activityKey: 'BRICK_MASONRY_M3',
      quantity: 10
    });
    assert.strictEqual(res.quantity, 10);
    assert.ok(res.totalManDays > 0);
    assert.ok(res.totalLabourCost > 0);
  });

  it('calculates deterministic BOQ totals, contractor profit, and GST', () => {
    const boq = BoqEngine.calculate({
      items: [
        { description: 'PCC Foundation', quantity: 10, unit: 'm³', materialRate: 3500, labourRate: 800 },
        { description: 'Brick Masonry', quantity: 20, unit: 'm³', materialRate: 5000, labourRate: 1500 }
      ],
      contractorProfitPercent: 10,
      overheadPercent: 5,
      contingencyPercent: 3,
      gstPercent: 18
    });

    // Item 1: 10 * (3500 + 800) = 43,000
    // Item 2: 20 * (5000 + 1500) = 130,000
    // Direct cost = 173,000
    assert.strictEqual(boq.financials.directCostSubtotal, 173000);
    assert.ok(boq.financials.grandTotal > 173000);
    assert.ok(boq.financials.formattedGrandTotal.includes('₹'));
  });
});
