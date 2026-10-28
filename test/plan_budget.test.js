/**
 * Plan to Budget & Takeoff Engine Test Suite
 * Tests PDF text extraction, drawing classification, scale calibration,
 * polygon takeoff area, draft BOQ generation, material procurement BOM,
 * and Multi-Sheet Excel XML / CSV exports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import zlib from 'node:zlib';

import { PdfExtractor } from '../src/plan/pdfExtractor.js';
import { TakeoffEngine } from '../src/plan/takeoffEngine.js';
import { BoqGenerator } from '../src/plan/boqGenerator.js';
import { MaterialProcurementEngine } from '../src/plan/materialProcurement.js';
import { ExcelExportEngine } from '../src/plan/excelExport.js';
import { apiClient } from '../public/js/apiClient.js';

describe('Plan to Budget & Takeoff Engine Test Suite', () => {
  // 1. PDF Text Operator and Drawing Classification Tests
  describe('PDF Text & Schedule Extraction', () => {
    it('extracts plain text strings from PDF text operators (BT...ET, Tj, TJ)', () => {
      const pdfContent = `
        %PDF-1.4
        1 0 obj
        << /Length 120 >>
        stream
        BT
        /F1 12 Tf
        (GROUND FLOOR PLAN) Tj
        [(LIVING) 20 (ROOM) 20 (4.88) 10 (x) 10 (3.66) 10 (M)] TJ
        (COLUMN SCHEDULE C1 230x450mm 6-16#) Tj
        ET
        endstream
        endobj
        trailer
        << /Root 1 0 R >>
        %%EOF
      `;
      const buffer = Buffer.from(pdfContent, 'utf-8');
      const result = PdfExtractor.extractPlan(buffer, { fileName: 'ground_floor_plan.pdf' });

      assert.strictEqual(result.classification, 'Floor Plan / தள வரைபடம்');
      assert.strictEqual(result.classificationConfidence, 'High');
      assert.ok(result.rawTextCount > 0);
      assert.ok(result.dimensions.length > 0, 'Should extract dimensions');
      assert.strictEqual(result.dimensions[0].length, 4.88);
      assert.strictEqual(result.dimensions[0].width, 3.66);
    });

    it('decompresses and extracts FlateDecode compressed PDF streams', () => {
      const uncompressedStream = 'BT /F1 14 Tf (STRUCTURAL FOUNDATION & COLUMN DETAILS) Tj (F1 1.5x1.5x0.45m) Tj ET';
      const deflated = zlib.deflateSync(Buffer.from(uncompressedStream, 'utf-8'));

      const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length ' + deflated.length + ' >>\nstream\n', 'utf-8');
      const footer = Buffer.from('\nendstream\nendobj\n%%EOF', 'utf-8');
      const buffer = Buffer.concat([header, deflated, footer]);

      const result = PdfExtractor.extractPlan(buffer, { fileName: 'structural_foundation.pdf' });
      assert.strictEqual(result.classification, 'Foundation / Footing Layout / அடித்தள வரைபடம்');
      assert.strictEqual(result.classificationConfidence, 'High');
      assert.ok(result.schedules.length > 0, 'Should detect structural schedules');
      assert.strictEqual(result.schedules[0].memberType, 'Footing');
    });

    it('classifies Column & Beam Schedule drawings accurately', () => {
      const text = 'BEAM SCHEDULE PLINTH BEAM PB1 230x300mm ROOF BEAM RB1 230x450mm';
      const buffer = Buffer.from(text, 'utf-8');
      const result = PdfExtractor.extractPlan(buffer, { fileName: 'beam_schedule.txt', mimeType: 'text/plain' });

      assert.strictEqual(result.classification, 'Beam Schedule & Details / பீம் விவர அட்டவணை');
      assert.ok(result.schedules.some(s => s.memberType === 'Beam'));
    });
  });

  // 2. Scale Calibration and Polygon Area Takeoff Tests
  describe('Scale Calibration & Takeoff Engine', () => {
    it('calibrates drawing scale from reference length (e.g. 90px = 0.9m door)', () => {
      const scale = TakeoffEngine.calibrateScale(90, 0.90, 'm');
      assert.strictEqual(scale.pixelsPerMeter, 100.0);
      assert.strictEqual(scale.pixelsPerFoot, 30.48);
    });

    it('computes polygon area using Shoelace formula correctly', () => {
      const scale = { pixelsPerMeter: 100.0 };
      // 4m x 5m rectangle in pixels: (0,0), (400,0), (400,500), (0,500)
      const points = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 500 },
        { x: 0, y: 500 }
      ];

      const res = TakeoffEngine.computePolygonArea(points, scale);
      assert.strictEqual(res.areaM2, 20.0);
      assert.strictEqual(res.areaSqft, 215.3); // 20 * 10.7639 rounded to 1 dec
      assert.strictEqual(res.perimeterM, 18.0); // 2*(4+5) = 18m
    });

    it('subtracts cutout deductions accurately from net takeoff area', () => {
      const baseAreaM2 = 25.0;
      const deductions = [
        { name: 'Pipe shaft cutout', length: 1.0, width: 1.0 }, // 1.0 m²
        { name: 'Ventilation duct', length: 0.5, width: 0.8 }   // 0.4 m²
      ];

      const res = TakeoffEngine.computeNetTakeoff(baseAreaM2, deductions);
      assert.strictEqual(res.grossAreaM2, 25.0);
      assert.strictEqual(res.totalDeductionsM2, 1.4);
      assert.strictEqual(res.netAreaM2, 23.6);
      assert.strictEqual(res.netAreaSqft, 254.0);
    });

    it('detects dimension conflict when discrepancy exceeds 5%', () => {
      // Nominal 10.0m, measured 10.8m (8% discrepancy)
      const check = TakeoffEngine.verifyDimensionConflict(10.0, 10.8, 5.0);
      assert.strictEqual(check.isConflict, true);
      assert.ok(check.discrepancyPercent > 5.0);

      // Nominal 10.0m, measured 10.2m (2% discrepancy - within 5% tolerance)
      const checkOk = TakeoffEngine.verifyDimensionConflict(10.0, 10.2, 5.0);
      assert.strictEqual(checkOk.isConflict, false);
    });
  });

  // 3. Draft Civil BOQ Generator Tests
  describe('Draft BOQ Generator (IS 456 & TN PWD SOR 2025-26)', () => {
    it('generates itemized civil works BOQ with 16 engineering items', () => {
      const projectData = {
        projectName: 'Vadapalani 2BHK Residence',
        district: 'Chennai',
        floorsCount: 1,
        rooms: [
          { name: 'Living Room', length: 4.88, width: 3.66, areaM2: 17.86, areaSqft: 192.2 },
          { name: 'Master Bed', length: 3.66, width: 3.66, areaM2: 13.40, areaSqft: 144.2 },
          { name: 'Kitchen', length: 3.05, width: 2.44, areaM2: 7.44, areaSqft: 80.1 },
          { name: 'Toilet', length: 2.13, width: 1.52, areaM2: 3.24, areaSqft: 34.9 }
        ],
        schedules: [
          { memberType: 'Column', memberMark: 'C1', count: 12 },
          { memberType: 'Footing', memberMark: 'F1', count: 12 }
        ]
      };

      const boq = BoqGenerator.generateDraftBoq(projectData);

      assert.strictEqual(boq.projectName, 'Vadapalani 2BHK Residence');
      assert.strictEqual(boq.district, 'Chennai');
      assert.strictEqual(boq.defaultStatus, 'Draft — Requires Review');
      assert.ok(boq.items.length >= 15, 'Should generate comprehensive BOQ items');

      // Verify essential civil works trades are present
      const trades = boq.items.map(i => i.trade);
      assert.ok(trades.includes('Earthwork'));
      assert.ok(trades.includes('Concrete'));
      assert.ok(trades.includes('RCC'));
      assert.ok(trades.includes('Steel & BBS'));
      assert.ok(trades.includes('Formwork'));
      assert.ok(trades.includes('Masonry'));
      assert.ok(trades.includes('Finishing'));
      assert.ok(trades.includes('Painting'));

      // Verify financial subtotal, overhead (5%), profit (10%), contingency (3%), and GST (18%)
      const fin = boq.financials;
      assert.ok(fin.directCostSubtotal > 0);
      assert.strictEqual(fin.overhead.percentage, 5.0);
      assert.strictEqual(fin.contractorProfit.percentage, 10.0);
      assert.strictEqual(fin.contingency.percentage, 3.0);
      assert.strictEqual(fin.gst.percentage, 18.0);
      assert.ok(fin.grandTotal > fin.directCostSubtotal);
      assert.ok(fin.costPerSqft > 1500, 'Residential construction in Chennai should be > ₹1500/sq.ft');
    });
  });

  // 4. Material Procurement BOM Engine Tests
  describe('Material Procurement BOM Engine', () => {
    it('aggregates materials into commercial pack sizes with zero double counting', () => {
      const projectData = {
        projectName: 'Anna Nagar Villa',
        floorsCount: 1,
        rooms: [
          { name: 'Hall', length: 5.0, width: 4.0, areaM2: 20.0, areaSqft: 215.3 }
        ]
      };
      const boq = BoqGenerator.generateDraftBoq(projectData);
      const materials = MaterialProcurementEngine.generateProcurementList(boq.items);

      assert.ok(materials.length >= 8, 'Should produce at least 8 key procurement materials');

      // 1. Cement
      const cement = materials.find(m => m.materialCode === 'MAT-CEM-01');
      assert.ok(cement);
      assert.strictEqual(cement.unit, 'Bags (50kg)');
      assert.ok(cement.orderQuantity > 0);
      assert.strictEqual(cement.wastagePercent, 2.0);

      // 2. M-Sand
      const sand = materials.find(m => m.materialCode === 'MAT-SND-01');
      assert.ok(sand);
      assert.strictEqual(sand.unit, 'TN Units (100 cft)');
      assert.ok(sand.orderQuantity > 0);

      // 3. Blue metal coarse aggregate
      const agg = materials.find(m => m.materialCode === 'MAT-AGG-01');
      assert.ok(agg);
      assert.strictEqual(agg.unit, 'TN Units (100 cft)');

      // 4. Fe550D Steel
      const steel = materials.find(m => m.materialCode === 'MAT-STL-01');
      assert.ok(steel);
      assert.strictEqual(steel.unit, 'Tonnes (MT)');

      // 5. Bricks
      const bricks = materials.find(m => m.materialCode === 'MAT-BRK-01');
      assert.ok(bricks);
      assert.strictEqual(bricks.unit, 'Nos');
      assert.strictEqual(bricks.wastagePercent, 5.0);
    });
  });

  // 5. Multi-Sheet Excel XML & CSV Export Tests
  describe('Multi-Sheet Excel XML & CSV Export', () => {
    it('generates Microsoft XML Spreadsheet 2003 with all 5 mandatory worksheets', () => {
      const boq = BoqGenerator.generateDraftBoq({ projectName: 'Adyar Duplex' });
      const materials = MaterialProcurementEngine.generateProcurementList(boq.items);

      const xml = ExcelExportEngine.generateWorkbookXml(boq, materials);

      assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(xml.includes('urn:schemas-microsoft-com:office:spreadsheet'));
      
      // Verify all 5 sheets exist in XML
      assert.ok(xml.includes('ss:Name="1. Project Summary"'), 'Should have Sheet 1: Summary');
      assert.ok(xml.includes('ss:Name="2. Bill of Quantities"'), 'Should have Sheet 2: BOQ');
      assert.ok(xml.includes('ss:Name="3. Material Procurement BOM"'), 'Should have Sheet 3: Procurement');
      assert.ok(xml.includes('ss:Name="4. Rates &amp; Basis"'), 'Should have Sheet 4: Rates');
      assert.ok(xml.includes('ss:Name="5. Assumptions &amp; IS Codes"'), 'Should have Sheet 5: Assumptions');

      // Verify branding and disclaimer in XML
      assert.ok(xml.includes('DDevUltraHome'));
      assert.ok(xml.includes('Adyar Duplex'));
      assert.ok(xml.includes('Draft Preliminary Takeoff'));
    });

    it('generates clean CSV format for supplier procurement', () => {
      const boq = BoqGenerator.generateDraftBoq({ projectName: 'Tambaram Project' });
      const materials = MaterialProcurementEngine.generateProcurementList(boq.items);

      const csv = ExcelExportEngine.generateProcurementCsv(materials);
      const lines = csv.split('\r\n');

      assert.ok(lines.length >= 9, 'Should have header + material rows');
      assert.ok(lines[0].includes('Material Code'));
      assert.ok(lines[0].includes('Commercial Pack Size'));
      assert.ok(csv.includes('MAT-CEM-01'));
      assert.ok(csv.includes('MAT-STL-01'));
    });
  });

  // 6. In-Process Client Dispatcher for Standalone APK & Offline PWA
  describe('In-Process Client Dispatcher for Standalone APK & Offline PWA', () => {
    it('dispatches /api/plan-budget/generate-boq in-process without network', async () => {
      const rooms = [
        { id: 'rm-1', name: 'Living & Dining Room', length: 4.88, width: 3.66, areaM2: 17.86, areaSqft: 192.2 },
        { id: 'rm-2', name: 'Master Bedroom', length: 3.66, width: 3.66, areaM2: 13.40, areaSqft: 144.2 }
      ];
      const res = await apiClient.executeLocal('/api/plan-budget/generate-boq', {
        method: 'POST',
        body: { projectName: 'Guindy Residence', district: 'Chennai', floorsCount: 1, columnsCount: 12, footingsCount: 12, rooms }
      });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.boq.items.length >= 10);
      assert.ok(data.boq.financials.grandTotal > 0);
    });

    it('dispatches /api/plan-budget/procurement in-process without network', async () => {
      const boq = BoqGenerator.generateDraftBoq({ projectName: 'Test' });
      const res = await apiClient.executeLocal('/api/plan-budget/procurement', {
        method: 'POST',
        body: { boqItems: boq.items }
      });
      assert.strictEqual(res.ok, true);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.materials));
      assert.strictEqual(data.materials.length, 8);
    });

    it('dispatches /api/plan-budget/export-excel in-process without network', async () => {
      const boq = BoqGenerator.generateDraftBoq({ projectName: 'Test' });
      const materials = MaterialProcurementEngine.generateProcurementList(boq.items);
      const res = await apiClient.executeLocal('/api/plan-budget/export-excel', {
        method: 'POST',
        body: { boq, materials }
      });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.headers.get('content-type'), 'application/vnd.ms-excel; charset=utf-8');
      const text = await res.text();
      assert.ok(text.includes('<?xml version="1.0" encoding="UTF-8"?>'));
    });
  });
});

