import test from 'node:test';
import assert from 'node:assert/strict';

import { RwhEngine } from '../src/engine/rwh.js';
import { DurabilityEngine } from '../src/engine/durability.js';
import { CmdaFeeEngine } from '../src/engine/cmdafee.js';
import { PlinthEngine } from '../src/engine/plinth.js';
import { PileEngine } from '../src/engine/pile.js';

test('1. Rainwater Harvesting (RWH) Sizer (TNCDBR Rule 42 & CMWSSB)', () => {
  const result = RwhEngine.calculate({
    roofAreaSqft: 1500,
    pavedAreaSqft: 600,
    soilPercolation: 'LOW' // Stiff clay in Velachery / Tambaram
  });

  assert.ok(result.annualPotentialLitres > 100000, 'Annual harvest potential should exceed 100,000 Litres');
  assert.ok(result.peakStormLitres > 2000, 'Single storm volume should be properly calculated');
  assert.ok(result.firstFlushLitres > 100, 'First flush separator should be sized');
  assert.equal(result.percolationSystem.numberOfPits, 2, '1500 sq.ft roof should require 2 percolation pits');
  assert.equal(result.percolationSystem.rechargeBore.depthM, 6.0, 'Clay soil should extend recharge bore to 6.0m');
  assert.equal(result.complianceStatus, 'COMPLIANT_TNCDBR_RULE_42');
});

test('2. Coastal Durability & Marine Exposure Controller (IS 456 Tables 3, 5, 16)', () => {
  // Test Case A: Sub-standard specification on Chennai coast
  const failResult = DurabilityEngine.evaluate({
    exposureCondition: 'SEVERE',
    proposedGrade: 'M20',
    proposedCoverMm: 20,
    elementType: 'BEAM',
    waterCementRatio: 0.55
  });

  assert.equal(failResult.complianceStatus, 'NON_COMPLIANT_CORROSION_RISK');
  assert.ok(failResult.warnings.length >= 2, 'Should flag grade and cover deficits for severe coastal exposure');

  // Test Case B: Full compliance with IS 456 for Chennai coastal zone
  const passResult = DurabilityEngine.evaluate({
    exposureCondition: 'SEVERE',
    proposedGrade: 'M30',
    proposedCoverMm: 45,
    elementType: 'BEAM',
    waterCementRatio: 0.44
  });

  assert.equal(passResult.complianceStatus, 'DURABILITY_COMPLIANT');
  assert.equal(passResult.specifications.minimumConcreteGrade, 'M30');
  assert.equal(passResult.specifications.mandatoryNominalCoverMm, 45);
});

test('3. CMDA & GCC Statutory Approval Fee Estimator', () => {
  const result = CmdaFeeEngine.estimateFees({
    plotAreaSqft: 2400,
    totalBuiltupSqft: 2600,
    locationZone: 'GCC_CORE',
    estimatedCostPerSqft: 2500
  });

  assert.ok(result.totalStatutoryAmount > 150000, 'Total statutory fees should be realistic for GCC core residential G+1');
  assert.ok(result.feeBreakdown.labourWelfareCess1Pct.amount > 50000, '1% BOCW labour cess should be 1% of total estimated construction');
  assert.ok(result.feeBreakdown.iaCharges.amount > 80000, 'I&A charges should be calculated per m²');
  assert.ok(result.feeBreakdown.developmentCharges.total > 20000, 'Development charges should have land and building components');
});

test('4. Post-Flood Plinth Height & DPC Waterproofing Engine', () => {
  // Test Case A: Deficient plinth height post-Michaung
  const lowPlinth = PlinthEngine.calculate({
    plinthAreaSqft: 1200,
    plinthHeightAboveRoadMm: 350
  });
  assert.equal(lowPlinth.plinthLevelStatus, 'SUB_STANDARD_FLOOD_RISK');
  assert.ok(lowPlinth.warnings.length > 0, 'Should warn when plinth is < 600mm above road');

  // Test Case B: Compliant plinth height (+750mm above road)
  const safePlinth = PlinthEngine.calculate({
    plinthAreaSqft: 1200,
    plinthHeightAboveRoadMm: 750
  });
  assert.equal(safePlinth.plinthLevelStatus, 'COMPLIANT_POST_MICHAUNG_STANDARD');
  assert.ok(safePlinth.fillMaterials.looseMoorumM3 > 0, 'Should compute moorum with 1.25 compaction');
  assert.ok(safePlinth.dpc.waterproofingAdmixtureLitres > 0, 'Should compute integral waterproofing liquid for DPC');
});

test('5. Short Bored Under-Reamed Pile Sizing (IS 2911 Part 3)', () => {
  const result = PileEngine.calculate({
    columnLoadKn: 600,
    pileDiameterMm: 300,
    pileLengthM: 4.5,
    cohesionCpkN: 60,
    numberOfBulbs: 1
  });

  assert.equal(result.pileDimensions.bulbDiameterMm, 750, 'Under-reamed bulb dia should be 2.5 * D (750mm)');
  assert.ok(result.capacity.ultimateCapacityKn > 200, 'Ultimate capacity should combine end bearing and shaft friction');
  assert.ok(result.capacity.safeWorkingCapacityKn > 100, 'Safe capacity with FOS 2.5 should be calculated');
  assert.ok(result.pileGroup.pilesRequiredCount >= 2, '600 kN column should require at least 2 piles in this soil');
  assert.ok(result.materialPerPile.concreteVolumeM3 > 0.4, 'Should compute concrete volume including bulb');
});
