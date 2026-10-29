import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanStudio3D,
  ReviewState,
  DimensionProvenance
} from '../src/plan/planStudio3D.js';
import { BoqGenerator } from '../src/plan/boqGenerator.js';

describe('Phase E, F, G: Parametric 2D-to-3D Plan Studio & Connected BOQ', () => {
  const sampleRooms = [
    { name: 'Living & Dining', lengthM: 2.77, widthM: 6.02, lengthFt: 9.08, widthFt: 19.75, areaM2: 16.68, areaSqft: 179.5, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Kitchen', lengthM: 2.13, widthM: 1.83, lengthFt: 7.0, widthFt: 6.0, areaM2: 3.90, areaSqft: 42.0, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Toilet 1', lengthM: 2.13, widthM: 1.22, lengthFt: 7.0, widthFt: 4.0, areaM2: 2.60, areaSqft: 28.0, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Bedroom 1', lengthM: 2.74, widthM: 2.74, lengthFt: 9.0, widthFt: 9.0, areaM2: 7.51, areaSqft: 81.0, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Foyer', lengthM: 3.30, widthM: 2.03, lengthFt: 10.83, widthFt: 6.67, areaM2: 6.70, areaSqft: 72.2, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Parking', lengthM: 6.10, widthM: 5.18, lengthFt: 20.0, widthFt: 17.0, areaM2: 31.60, areaSqft: 340.0, floor: 'GROUND_FLOOR', pageNumber: 1 },
    { name: 'Bedroom 02', lengthM: 2.74, widthM: 2.74, lengthFt: 9.0, widthFt: 9.0, areaM2: 7.51, areaSqft: 81.0, floor: 'FIRST_FLOOR', pageNumber: 2 },
    { name: 'Toilet 2', lengthM: 2.74, widthM: 1.22, lengthFt: 9.0, widthFt: 4.0, areaM2: 3.34, areaSqft: 36.0, floor: 'FIRST_FLOOR', pageNumber: 2 }
  ];

  it('builds a parametric 3D building model from 2D architectural rooms', () => {
    const studio = new PlanStudio3D({ projectName: 'Guindy Residence' });
    const result = studio.buildModelFrom2DPlan(sampleRooms);

    assert.ok(result.elementsSummary.wallsCount > 0, 'Must generate walls');
    assert.ok(result.elementsSummary.slabsCount > 0, 'Must generate floor slabs');
    assert.equal(result.elementsSummary.columnsCount, 0, 'Must NOT invent columns without structural schedule');
    assert.equal(result.elementsSummary.footingsCount, 0, 'Must NOT invent footings without structural schedule');
    assert.ok(result.elementsSummary.doorsCount > 0, 'Must generate doors');
    assert.ok(result.elementsSummary.windowsCount > 0, 'Must generate windows');

    assert.equal(studio.isConstructionReady, false, 'Non-negotiable rule: Must never be labeled construction ready without engineer review');
  });

  it('distinguishes 230mm external walls from 115mm internal partition walls with proper cutouts', () => {
    const studio = new PlanStudio3D();
    studio.buildModelFrom2DPlan(sampleRooms);

    const extWalls = studio.elements.walls.filter(w => w.isExternal);
    const intWalls = studio.elements.walls.filter(w => !w.isExternal);

    assert.ok(extWalls.length > 0);
    assert.ok(intWalls.length > 0);
    assert.ok(extWalls.every(w => w.thicknessM === 0.23), 'External walls must be 230mm thick');
    assert.ok(intWalls.every(w => w.thicknessM === 0.115), 'Internal walls must be 115mm thick');

    // Check opening cutouts
    const doors = studio.elements.doors;
    const windows = studio.elements.windows;
    assert.ok(doors.length > 0);
    assert.ok(windows.length > 0);
    assert.equal(doors[0].heightM, 2.10, 'Standard door height must be 2.10m');
    assert.equal(windows[0].heightM, 1.20, 'Standard window height must be 1.20m');
  });

  it('validates geometry: closed polygons, duplicate wall removal, and area consistency', () => {
    const studio = new PlanStudio3D();
    studio.buildModelFrom2DPlan(sampleRooms);
    const validation = studio.validateGeometry();

    assert.equal(validation.isValid, true);
    assert.equal(validation.errors.length, 0);
  });

  it('enforces Review Gate lifecycle and never allows uncertified model to be marked construction-ready', () => {
    const studio = new PlanStudio3D();
    studio.buildModelFrom2DPlan(sampleRooms);

    assert.equal(studio.reviewState, ReviewState.DRAFT);

    studio.setReviewGate(ReviewState.NEEDS_INPUT, 'Awaiting structural drawing coordination');
    assert.equal(studio.reviewState, ReviewState.NEEDS_INPUT);

    studio.setReviewGate(ReviewState.APPROVED_FOR_ESTIMATION, 'Dimensions confirmed for preliminary cost estimate');
    assert.equal(studio.reviewState, ReviewState.APPROVED_FOR_ESTIMATION);
    assert.equal(studio.isConstructionReady, false, 'Approval for estimation is NOT construction readiness');

    assert.throws(() => {
      studio.setReviewGate('CONSTRUCTION_READY');
    }, /Invalid review state/);
  });

  it('derives accurate civil quantities directly from 3D model geometry', () => {
    const studio = new PlanStudio3D();
    studio.buildModelFrom2DPlan(sampleRooms);
    const qty = studio.computeQuantities();

    assert.ok(qty.totalBrickworkM3 > 0, 'Brickwork volume must be positive');
    assert.ok(qty.internalPlasteringM2 > 0, 'Internal plastering area must be positive');
    assert.ok(qty.externalPlasteringM2 > 0, 'External plastering area must be positive');
    assert.ok(qty.totalRccConcreteM3 > 0, 'Total RCC concrete must be positive');
    assert.ok(qty.reinforcementSteelKg > 0, 'Steel weight must be positive');
    assert.ok(qty.flooringTilingM2 > 0, 'Flooring area must be positive');
  });

  it('connects 3D parametric quantities directly to BoqGenerator with Review Gate integration', () => {
    const studio = new PlanStudio3D({ projectName: 'Guindy Residence' });
    studio.buildModelFrom2DPlan(sampleRooms);
    studio.setReviewGate(ReviewState.APPROVED_FOR_ESTIMATION, 'Confirmed dimensions');
    const qty3D = studio.computeQuantities();

    const boq = BoqGenerator.generateDraftBoq({
      projectName: 'Guindy Residence',
      district: 'Chennai',
      floorsCount: 2,
      rooms: sampleRooms,
      quantities3D: qty3D,
      reviewState: studio.reviewState
    });

    assert.equal(boq.reviewState, ReviewState.APPROVED_FOR_ESTIMATION);
    assert.equal(boq.isConstructionReady, false);
    assert.ok(boq.provenanceSummary.includes('verified 2D-to-3D parametric takeoff'));

    // Verify 3D quantities replaced approximations in BOQ
    const slabItem = boq.items.find(i => i.itemCode === 'ITEM-06');
    assert.equal(slabItem.netQuantity, qty3D.slabConcreteM3);
    assert.equal(slabItem.confidenceStatus, 'Verified 3D');

    const steelItem = boq.items.find(i => i.itemCode === 'ITEM-07');
    assert.equal(steelItem.netQuantity, qty3D.reinforcementSteelKg);
    assert.equal(steelItem.confidenceStatus, 'Verified 3D');

    const extBrickItem = boq.items.find(i => i.itemCode === 'ITEM-09');
    assert.equal(extBrickItem.netQuantity, qty3D.externalBrickworkM3);
    assert.equal(extBrickItem.confidenceStatus, 'Verified 3D');

    const intBrickItem = boq.items.find(i => i.itemCode === 'ITEM-10');
    assert.equal(intBrickItem.confidenceStatus, 'Verified 3D');

    const intPlasterItem = boq.items.find(i => i.itemCode === 'ITEM-11');
    assert.equal(intPlasterItem.netQuantity, qty3D.internalPlasteringM2);
    assert.equal(intPlasterItem.confidenceStatus, 'Verified 3D');

    const tileItem = boq.items.find(i => i.itemCode === 'ITEM-12');
    assert.equal(tileItem.netQuantity, qty3D.flooringTilingM2);
    assert.equal(tileItem.confidenceStatus, 'Verified 3D');
  });
});
