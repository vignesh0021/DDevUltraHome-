/**
 * Septic Tank & Contractor Payment Milestones Test Suite
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { SepticTankEngine } from '../src/engine/septictank.js';
import { MilestonesEngine, STANDARD_CONTRACT_MILESTONES } from '../src/engine/milestones.js';

describe('Septic Tank & Soak Pit Design (IS 2470)', () => {
  it('designs residential septic tank for 10 users accurately', () => {
    const res = SepticTankEngine.calculate({
      users: 10,
      sewageFlowLpcd: 90,
      detentionHours: 24,
      cleaningIntervalYears: 2
    });

    assert.strictEqual(res.occupancy, 10);
    assert.strictEqual(res.dailySewageLitres, 900);
    assert.ok(res.liquidCapacityLitres > 0);
    assert.ok(res.dimensions.lengthM > res.dimensions.widthM);
    assert.strictEqual(res.dimensions.freeboardM, 0.30);
    assert.ok(res.soakPit.depthM >= 1.8);
  });

  it('rejects zero or negative user count', () => {
    assert.throws(() => SepticTankEngine.calculate({ users: 0 }), /greater than 0/);
    assert.throws(() => SepticTankEngine.calculate({ users: -5 }), /greater than 0/);
  });
});

describe('Contractor Payment Milestones Engine', () => {
  it('generates 7-stage payment schedule summing to 100% of contract', () => {
    const contractValue = 3500000; // ₹35 Lakhs
    const schedule = MilestonesEngine.calculateSchedule(contractValue);

    assert.strictEqual(schedule.totalContractAmount, contractValue);
    assert.strictEqual(schedule.stagesCount, 7);

    const lastStage = schedule.schedule[6];
    assert.strictEqual(lastStage.cumulativePercentage, 100);
    assert.strictEqual(lastStage.cumulativeAmount, contractValue);

    // Stage 1 is 10% = 350,000
    assert.strictEqual(schedule.schedule[0].percentage, 10);
    assert.strictEqual(schedule.schedule[0].amount, 350000);
    assert.strictEqual(schedule.schedule[0].formattedAmount, '₹ 3,50,000.00');

    // Stage 4 (Roof Slab) is 20% = 700,000
    assert.strictEqual(schedule.schedule[3].percentage, 20);
    assert.strictEqual(schedule.schedule[3].amount, 700000);
  });
});
