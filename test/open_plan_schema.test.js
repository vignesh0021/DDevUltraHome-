import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenPlanSchema, ReviewState, DimensionProvenance } from '../src/plan/openPlanSchema.js';

describe('OpenPlan3D Normalized Schema & Geometry Engine', () => {
  const sampleRooms = [
    { id: 'rm-1', name: 'Living & Dining Room', lengthM: 2.77, widthM: 6.02, floor: 'GROUND_FLOOR', provenance: DimensionProvenance.EXTRACTED_CAD_TEXT },
    { id: 'rm-2', name: 'Kitchen', lengthM: 2.13, widthM: 1.83, floor: 'GROUND_FLOOR', provenance: DimensionProvenance.EXTRACTED_CAD_TEXT },
    { id: 'rm-3', name: 'Toilet', lengthM: 2.13, widthM: 1.22, floor: 'GROUND_FLOOR', provenance: DimensionProvenance.EXTRACTED_CAD_TEXT },
    { id: 'rm-4', name: 'Bedroom 02', lengthM: 2.74, widthM: 2.74, floor: 'FIRST_FLOOR', provenance: DimensionProvenance.EXTRACTED_CAD_TEXT }
  ];

  it('converts 2D room takeoffs into valid OpenPlan3D model with separate floors', () => {
    const model = OpenPlanSchema.toOpenPlanModel(sampleRooms, {
      projectName: 'Guindy Residence Test'
    });

    assert.equal(model.version, 1);
    assert.equal(model.name, 'Guindy Residence Test');
    assert.equal(model.floors.length, 2);

    const ground = model.floors[0];
    assert.equal(ground.level, 0);
    assert.equal(ground.name, 'Ground Floor (தரைத்தளம்)');
    assert.equal(ground.rooms.length, 3);
    assert.ok(ground.walls.length > 0);
    assert.ok(ground.doors.length > 0);

    const first = model.floors[1];
    assert.equal(first.level, 1);
    assert.equal(first.name, 'First Floor (முதல் தளம்)');
    assert.equal(first.rooms.length, 1);

    const validation = OpenPlanSchema.validateFloorPlan(model);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  it('deduplicates shared walls and properly marks internal partition vs external walls', () => {
    // Two adjacent rooms sharing a wall
    const adjacentRooms = [
      { id: 'r1', name: 'Room 1', lengthM: 3.0, widthM: 3.0, floor: 'GROUND_FLOOR' },
      { id: 'r2', name: 'Room 2', lengthM: 3.0, widthM: 3.0, floor: 'GROUND_FLOOR' }
    ];

    const model = OpenPlanSchema.toOpenPlanModel(adjacentRooms);
    const ground = model.floors[0];

    // Two 3x3 rooms placed adjacent should share 1 interior wall (total walls = 7, not 8)
    assert.equal(ground.walls.length, 7);
    const internalWalls = ground.walls.filter(w => !w.isExternal);
    assert.equal(internalWalls.length, 1);
    assert.equal(internalWalls[0].thicknessM, 0.115); // 115mm partition wall
    assert.equal(internalWalls[0].sharedRooms.length, 2);
  });

  it('subdivides wall into physical segments around door opening (no decorative decals)', () => {
    const wallLength = 4.0;
    const wallHeight = 2.80;
    const doors = [{ widthM: 0.90, heightM: 2.10, position: 0.5 }];
    const windows = [];

    const segments = OpenPlanSchema.buildWallSegments(wallLength, wallHeight, doors, windows);

    // Wall with door at center should have:
    // 1. Left solid segment (from 0 to 1.55m -> width 1.55m, height 2.8m)
    // 2. Right solid segment (from 2.45 to 4.0m -> width 1.55m, height 2.8m)
    // 3. Lintel segment above door (from 1.55 to 2.45m -> width 0.9m, from 2.1m to 2.8m -> height 0.7m)
    // Door opening itself (from 0 to 2.1m) is an EMPTY physical cutout
    assert.equal(segments.length, 3);

    const lintel = segments.find(s => s.type === 'LINTEL');
    assert.ok(lintel, 'Must generate lintel segment above door');
    assert.equal(lintel.width, 0.90);
    assert.equal(Math.round(lintel.height * 100) / 100, 0.70); // 2.80 - 2.10 = 0.70m

    const solids = segments.filter(s => s.type === 'SOLID');
    assert.equal(solids.length, 2);
  });

  it('subdivides wall into sill, window cutout, and lintel segments around window opening', () => {
    const wallLength = 4.0;
    const wallHeight = 2.80;
    const doors = [];
    const windows = [{ widthM: 1.20, heightM: 1.20, sillHeightM: 0.90, position: 0.5 }];

    const segments = OpenPlanSchema.buildWallSegments(wallLength, wallHeight, doors, windows);

    // Window at center:
    // Left solid, right solid, bottom sill segment, top lintel segment
    assert.equal(segments.length, 4);

    const sill = segments.find(s => s.type === 'SILL');
    assert.ok(sill, 'Must generate sill segment below window');
    assert.equal(sill.width, 1.20);
    assert.equal(sill.height, 0.90);

    const lintel = segments.find(s => s.type === 'LINTEL');
    assert.ok(lintel, 'Must generate lintel segment above window');
    assert.equal(lintel.width, 1.20);
    assert.equal(Math.round(lintel.height * 100) / 100, 0.70); // 2.80 - 2.10 = 0.70m
  });

  it('derives accurate civil quantities with opening deductions and zero invented structures', () => {
    const model = OpenPlanSchema.toOpenPlanModel(sampleRooms);
    const qty = OpenPlanSchema.deriveQuantitiesFromOpenPlan(model);

    assert.ok(qty.totalCarpetAreaM2 > 0);
    assert.ok(qty.totalBuiltupAreaM2 > qty.totalCarpetAreaM2);
    assert.ok(qty.externalBrickworkVolumeM3 > 0);
    assert.ok(qty.internalBrickworkVolumeM3 > 0);
    assert.ok(qty.doorsCount > 0);
    assert.ok(qty.totalPlasterAreaM2 > 0);
    // Explicitly verify NO invented structural elements
    assert.equal(qty.columnsCount, undefined);
    assert.equal(qty.footingsCount, undefined);
  });
});
