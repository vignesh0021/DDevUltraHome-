import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PdfExtractor } from '../src/plan/pdfExtractor.js';

describe('Phase D: Reference Drawing Test Case & PDF Extraction Refactor', () => {
  const fixturePath = path.resolve('test/fixtures/guindy_residence_scheme.pdf');
  const pdfBuffer = fs.readFileSync(fixturePath);

  it('correctly reports 2 pages from PDF Page Tree catalog for Guindy residence scheme', () => {
    const result = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'JAS - GUINDY RESIDENCE - SCHEME R0 24042026.pdf' });

    assert.equal(result.totalPages, 2, 'Must report exactly 2 pages from the PDF page tree');
    assert.equal(result.hasSelectableText, true);
    assert.equal(result.extractionMethod, 'NATIVE_PDF_STREAM_PARSER');
    assert.equal(result.sheets.length, 2);

    // Page 1 assertions
    const page1 = result.sheets[0];
    assert.equal(page1.pageNumber, 1);
    assert.ok(page1.sheetTitle.toLowerCase().includes('ground') || page1.sheetTitle.toLowerCase().includes('scheme'));
    assert.deepEqual(page1.mediaBox, [0, 0, 595, 842]);
    assert.equal(page1.widthPt, 595);
    assert.equal(page1.heightPt, 842);

    // Page 2 assertions
    const page2 = result.sheets[1];
    assert.equal(page2.pageNumber, 2);
    assert.ok(page2.sheetTitle.toLowerCase().includes('first') || page2.sheetTitle.toLowerCase().includes('scheme'));
    assert.deepEqual(page2.mediaBox, [0, 0, 595, 842]);
  });

  it('specifically detects "Drawings should not be scaled for obtaining dimensions" and records restrictions', () => {
    const result = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'JAS - GUINDY RESIDENCE - SCHEME R0 24042026.pdf' });

    assert.ok(result.scaleRestrictions, 'Scale restrictions must exist');
    assert.equal(result.scaleRestrictions.doNotScale, true);
    assert.equal(result.scaleRestrictions.pixelScalingRestricted, true);
    assert.equal(result.scaleRestrictions.requiresManualConfirmation, true);
    assert.ok(result.scaleRestrictions.reason.includes('Drawings should not be scaled'));

    // Check CAD notes
    assert.ok(result.cadNotes.length > 0);
    assert.ok(result.cadNotes.some(n => n.includes('Drawings should not be scaled')));
    assert.ok(result.cadNotes.some(n => n.includes('Feet and inches')));
    assert.ok(result.cadNotes.some(n => n.includes('Architect before')));

    // Architect metadata
    assert.ok(result.architectDetails);
    assert.equal(result.architectDetails.name, 'J-angle studio, Chennai');
    assert.ok(result.architectDetails.email.includes('janglestudio@gmail.com'));
  });

  it('extracts room takeoffs and dimensions per sheet with spatial coordinates and confirmation flags', () => {
    const result = PdfExtractor.extractPlan(pdfBuffer, { fileName: 'JAS - GUINDY RESIDENCE - SCHEME R0 24042026.pdf' });

    // Page 1 rooms
    const page1 = result.sheets[0];
    const p1RoomNames = page1.roomTakeoffs.map(r => r.name);
    assert.ok(p1RoomNames.includes('KITCHEN'), 'Page 1 must contain Kitchen');
    assert.ok(p1RoomNames.includes('LIVING & DINING'), 'Page 1 must contain Living & Dining');
    assert.ok(p1RoomNames.includes('FOYER'), 'Page 1 must contain Foyer');
    assert.ok(p1RoomNames.includes('PARKING'), 'Page 1 must contain Parking');

    const kitchen = page1.roomTakeoffs.find(r => r.name === 'KITCHEN');
    assert.equal(kitchen.lengthFt, 7);
    assert.equal(kitchen.widthFt, 6);
    assert.equal(kitchen.floor, 'GROUND_FLOOR');
    assert.equal(kitchen.requiresManualConfirmation, true, 'Must require confirmation due to "do not scale" note');

    // Page 2 rooms
    const page2 = result.sheets[1];
    const p2RoomNames = page2.roomTakeoffs.map(r => r.name);
    assert.ok(p2RoomNames.includes('BEDROOM 02'), 'Page 2 must contain Bedroom 02');
    assert.ok(p2RoomNames.includes('TOILET'), 'Page 2 must contain Toilet');

    const bed2 = page2.roomTakeoffs.find(r => r.name === 'BEDROOM 02');
    assert.equal(bed2.lengthFt, 9);
    assert.equal(bed2.widthFt, 9);
    assert.equal(bed2.floor, 'FIRST_FLOOR');

    // Check dimensions have coordinates
    const kitchenDim = page1.dimensions.find(d => d.rawText.includes("7'-0") && d.rawText.includes("6'-0"));
    assert.ok(kitchenDim, 'Kitchen dimension record must exist');
    assert.ok(kitchenDim.coordinates, 'Coordinates must be captured from text operations');
    assert.ok(kitchenDim.coordinates.x > 0);
    assert.ok(kitchenDim.coordinates.y > 0);
  });
});
