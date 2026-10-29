import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfExtractor } from '../src/plan/pdfExtractor.js';
import { OpenPlanSchema } from '../src/plan/openPlanSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AutoCAD G+2 Floor Residential Building Plan Extraction & 3D Integration', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'g2_residential_building_plan.pdf');
  const pdfBuffer = fs.readFileSync(fixturePath);

  test('extracts AutoCAD vector plan synchronously with /ToUnicode CMap font decoding', () => {
    const result = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'g2_residential_building_plan.pdf' });

    assert.ok(result, 'Result should exist');
    assert.equal(result.totalPages, 3, 'Should partition single sheet into 3 distinct floor sheets');
    assert.ok(result.hasSelectableText, 'Should have selectable vector text');
    assert.equal(result.extractionMethod, 'NATIVE_PDF_STREAM_PARSER');

    // Project name
    assert.ok(result.projectName, 'Project title should be extracted');
    assert.ok(
      result.projectName.toUpperCase().includes('G+2') || result.projectName.toUpperCase().includes('RESIDENTIAL'),
      `Project title should mention G+2 or RESIDENTIAL: ${result.projectName}`
    );

    // Floor sheet titles
    const titles = result.sheets.map(s => s.sheetTitle);
    assert.ok(titles.some(t => t.includes('GROUND')), 'Should have Ground Floor sheet');
    assert.ok(titles.some(t => t.includes('FIRST')), 'Should have First Floor sheet');
    assert.ok(titles.some(t => t.includes('SECOND')), 'Should have Second Floor sheet');

    // Joinery schedule
    assert.ok(result.schedules.length >= 6, 'Should extract at least 6 joineries');
    const marks = result.schedules.map(s => s.itemMark || s.code);
    assert.ok(marks.includes('MD'), 'Should include Main Door (MD)');
    assert.ok(marks.includes('D'), 'Should include Door (D)');
    assert.ok(marks.includes('D2'), 'Should include Door 2 (D2)');
    assert.ok(marks.includes('W2'), 'Should include Window 2 (W2)');
    assert.ok(marks.includes('W3'), 'Should include Window 3 (W3)');
    assert.ok(marks.includes('V'), 'Should include Ventilator (V)');

    // Ground Floor rooms
    const groundRooms = result.rooms.filter(r => r.floor === 'GROUND_FLOOR');
    const groundNames = groundRooms.map(r => r.name);
    assert.ok(groundNames.includes('CAR PARKING'), 'Ground floor must include CAR PARKING');
    assert.ok(groundNames.includes('LIVING HALL'), 'Ground floor must include LIVING HALL');
    assert.ok(groundNames.includes('M. BED ROOM'), 'Ground floor must include M. BED ROOM');
    assert.ok(groundNames.includes('KITCHEN'), 'Ground floor must include KITCHEN');
    assert.ok(groundNames.includes('TOILET'), 'Ground floor must include TOILET');

    // First Floor rooms
    const firstRooms = result.rooms.filter(r => r.floor === 'FIRST_FLOOR');
    const firstNames = firstRooms.map(r => r.name);
    assert.ok(firstNames.includes('LIVING HALL'), 'First floor must include LIVING HALL');
    assert.ok(firstNames.includes('M. BED ROOM'), 'First floor must include M. BED ROOM');
    assert.ok(firstNames.includes('KITCHEN CUM DINING') || firstNames.includes('KITCHEN'), 'First floor must include Kitchen/Dining');
    assert.ok(firstNames.includes('POOJA'), 'First floor must include POOJA');
    assert.ok(firstNames.includes('TOILET'), 'First floor must include TOILET');

    // Second Floor rooms
    const secondRooms = result.rooms.filter(r => r.floor === 'SECOND_FLOOR');
    const secondNames = secondRooms.map(r => r.name);
    assert.ok(secondNames.includes('M. BED ROOM'), 'Second floor must include M. BED ROOM');
    assert.ok(secondNames.includes('TOILET'), 'Second floor must include TOILET');
    assert.ok(secondNames.includes('BALCONY'), 'Second floor must include BALCONY');
  });

  test('extracts AutoCAD vector plan asynchronously via extractPlanAsync (matching sync results)', async () => {
    const syncRes = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'g2_residential_building_plan.pdf' });
    const asyncRes = await PdfExtractor.extractPlanAsync(pdfBuffer, { fileName: 'g2_residential_building_plan.pdf' });

    assert.equal(asyncRes.totalPages, syncRes.totalPages);
    assert.equal(asyncRes.rooms.length, syncRes.rooms.length);
    assert.equal(asyncRes.schedules.length, syncRes.schedules.length);
    assert.equal(asyncRes.projectName, syncRes.projectName);

    // Verify room dimensions match
    for (let i = 0; i < syncRes.rooms.length; i++) {
      assert.equal(asyncRes.rooms[i].name, syncRes.rooms[i].name);
      assert.equal(asyncRes.rooms[i].floor, syncRes.rooms[i].floor);
      assert.equal(asyncRes.rooms[i].lengthM, syncRes.rooms[i].lengthM);
      assert.equal(asyncRes.rooms[i].widthM, syncRes.rooms[i].widthM);
    }
  });

  test('converts extracted G+2 rooms into valid multi-level OpenPlan3D model', () => {
    const result = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'g2_residential_building_plan.pdf' });
    const model = OpenPlanSchema.toOpenPlanModel(result.rooms, {
      projectName: result.projectName,
      schedules: result.schedules
    });

    assert.ok(model, 'Model must be generated');
    assert.ok(model.floors.length >= 3, 'Must contain at least 3 levels (Ground, First, Second)');

    const groundLevel = model.floors.find(l => l.level === 0);
    const firstLevel = model.floors.find(l => l.level === 1);
    const secondLevel = model.floors.find(l => l.level === 2);

    assert.ok(groundLevel, 'Ground level exists');
    assert.ok(firstLevel, 'First level exists');
    assert.ok(secondLevel, 'Second level exists');

    assert.ok(groundLevel.rooms.length >= 4, 'Ground level has rooms');
    assert.ok(firstLevel.rooms.length >= 4, 'First level has rooms');
    assert.ok(secondLevel.rooms.length >= 2, 'Second level has rooms');

    // Walls generated for all levels
    assert.ok(groundLevel.walls.length > 4, 'Ground level has walls');
    assert.ok(firstLevel.walls.length > 4, 'First level has walls');
    assert.ok(secondLevel.walls.length > 2, 'Second level has walls');
  });
});
