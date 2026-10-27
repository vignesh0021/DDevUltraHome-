/**
 * Bar Bending Schedule (BBS) Test Suite
 * Tests unit weights (d²/162), bend deductions, and stirrup cutting lengths per IS 2502
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { BbsEngine } from '../src/engine/bbs.js';
import { SafeMath } from '../src/engine/math.js';

describe('BBS & Reinforcement Steel Engine Tests', () => {
  it('verifies standard steel unit weights per meter (d²/162.28)', () => {
    // 8mm bar: 8² / 162.28 = 0.3944 kg/m (standard ~0.395 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(8), 3), 0.394);

    // 10mm bar: 10² / 162.28 = 0.6162 kg/m (standard ~0.617 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(10), 3), 0.616);

    // 12mm bar: 12² / 162.28 = 0.8874 kg/m (standard ~0.888 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(12), 3), 0.887);

    // 16mm bar: 16² / 162.28 = 1.5775 kg/m (standard ~1.58 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(16), 2), 1.58);

    // 20mm bar: 20² / 162.28 = 2.4649 kg/m (standard ~2.47 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(20), 2), 2.46);

    // 25mm bar: 25² / 162.28 = 3.8514 kg/m (standard ~3.85 kg/m)
    assert.strictEqual(SafeMath.round(BbsEngine.getUnitWeight(25), 2), 3.85);
  });

  it('verifies IS 2502 bend deductions', () => {
    const dia = 16;
    // 45° = 1d = 16mm
    assert.strictEqual(BbsEngine.getBendDeduction(dia, 45), 16);
    // 90° = 2d = 32mm
    assert.strictEqual(BbsEngine.getBendDeduction(dia, 90), 32);
    // 135° = 3d = 48mm
    assert.strictEqual(BbsEngine.getBendDeduction(dia, 135), 48);
    // 180° = 4d = 64mm
    assert.strictEqual(BbsEngine.getBendDeduction(dia, 180), 64);
  });

  it('calculates rectangular beam stirrup cutting length correctly', () => {
    // 230mm x 450mm beam, 8mm stirrup, 25mm clear cover
    // a = 230 - 50 = 180mm
    // b = 450 - 50 = 400mm
    // Hooks (2 nos @ 135°): 2 * max(10*8, 75) = 2 * 80 = 160mm
    // Bend deductions: (3 * 2 * 8) + (2 * 3 * 8) = 48 + 48 = 96mm
    // Cutting length = 2*(180 + 400) + 160 - 96 = 1160 + 160 - 96 = 1224mm = 1.224m
    const res = BbsEngine.calculateStirrup({
      memberWidthMm: 230,
      memberDepthMm: 450,
      barDiameterMm: 8,
      clearCoverMm: 25,
      hookAngle: 135
    });

    assert.strictEqual(res.coreWidthMm, 180);
    assert.strictEqual(res.coreDepthMm, 400);
    assert.strictEqual(res.cuttingLengthMm, 1224);
    assert.strictEqual(res.cuttingLengthM, 1.224);
    assert.ok(res.weightPerStirrupKg > 0);
  });

  it('generates multi-item schedule and group summary', () => {
    const schedule = BbsEngine.generateSchedule([
      { mark: 'B1-Bottom', description: 'Beam 1 Bottom Bars', diameterMm: 16, numberOfMembers: 2, barsPerMember: 3, cuttingLengthM: 4.5 },
      { mark: 'B1-Top', description: 'Beam 1 Top Bars', diameterMm: 12, numberOfMembers: 2, barsPerMember: 2, cuttingLengthM: 4.5 },
      { mark: 'B1-Stirrup', description: 'Beam 1 Stirrups', diameterMm: 8, numberOfMembers: 2, barsPerMember: 25, cuttingLengthM: 1.224 }
    ]);

    assert.strictEqual(schedule.scheduleItems.length, 3);
    assert.strictEqual(schedule.diameterBreakdown.length, 3);
    assert.ok(schedule.totals.totalWeightKg > 0);
    assert.ok(schedule.totals.totalWeightTonnes > 0);
  });
});
