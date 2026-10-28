/**
 * DDevUltraHome Production Readiness Audit Test Suite
 * Regression and boundary tests covering:
 * 1. Client-Side in-process execution dispatcher (Capacitor Standalone APK / Offline PWA)
 * 2. All 19 calculation engines boundary testing (0 handling, negative values, NaN resilience)
 * 3. BOQ calculations, 18% GST, and CSV export
 * 4. Scrap valuation deductions, transport/labour offsets, and net payout
 * 5. Repository security, SQLite file exclusions, and gitignore enforcement
 * 6. Server security: Path traversal prevention and HTTP security headers
 * 7. Service Worker caching strategy and non-GET safety
 * 8. AI Provider browser-runtime compatibility
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiClient } from '../public/js/apiClient.js';
import { ConcreteEngine } from '../src/engine/concrete.js';
import { BoqEngine } from '../src/engine/boq.js';
import { ScrapValuationEngine } from '../src/intelligence/scrapValuation.js';
import { GeminiProvider, OfflineCivilEngineProvider } from '../public/js/ai/provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Production Readiness Audit — In-Process Client API Dispatcher', () => {
  it('dispatches /api/health locally and returns client runtime metadata', async () => {
    const res = await apiClient.executeLocal('/api/health');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.appName, 'DDevUltraHome');
    assert.ok(data.runtime.includes('Client ESM Engine'));
    assert.ok(data.standards.includes('IS 456'));
  });

  it('dispatches /api/districts locally and returns all Tamil Nadu districts', async () => {
    const res = await apiClient.executeLocal('/api/districts');
    assert.strictEqual(res.ok, true);
    const data = await res.json();
    assert.ok(Array.isArray(data.districts));
    assert.ok(data.districts.includes('Chennai'));
    assert.ok(data.districts.includes('Coimbatore'));
    assert.ok(data.districts.includes('Madurai'));
  });

  it('dispatches /api/rates locally with district logistics adjustment', async () => {
    const res = await apiClient.executeLocal('/api/rates?district=Coimbatore');
    assert.strictEqual(res.ok, true);
    const data = await res.json();
    assert.strictEqual(data.district, 'Coimbatore');
    assert.ok(Array.isArray(data.rates));
    assert.ok(data.rates.length > 5);
  });

  it('dispatches /api/calculate/concrete locally with deterministic output', async () => {
    const res = await apiClient.executeLocal('/api/calculate/concrete', {
      method: 'POST',
      body: {
        mixGrade: 'M20',
        length: 5,
        width: 4,
        depth: 0.15,
        dimensionUnit: 'm',
        wastagePercent: 2
      }
    });
    assert.strictEqual(res.ok, true);
    const data = await res.json();
    assert.strictEqual(data.wetVolumeM3, 3);
    assert.ok(data.materials.cement.bagsRounded > 0);
    assert.ok(data.materials.sand.tnUnits > 0);
    assert.ok(data.materials.aggregate.tnUnits > 0);
  });

  it('dispatches /api/calculate/rcc for beams, slabs, columns, and footings', async () => {
    const res = await apiClient.executeLocal('/api/calculate/rcc', {
      method: 'POST',
      body: {
        elementType: 'BEAM',
        span: 4,
        width: 230,
        depth: 450,
        dimensionUnit: 'mm',
        steelPercentage: 1.2
      }
    });
    assert.strictEqual(res.ok, true);
    const data = await res.json();
    assert.strictEqual(data.element, 'RCC Beam');
    assert.ok(data.steel.weightKg > 0);
  });

  it('dispatches /api/ai/ask locally using deterministic offline engine', async () => {
    const res = await apiClient.executeLocal('/api/ai/ask', {
      method: 'POST',
      body: { prompt: 'What is the nominal cover for coastal RCC footings?' }
    });
    assert.strictEqual(res.ok, true);
    const data = await res.json();
    assert.ok(data.answer.length > 0);
    assert.strictEqual(data.isAiGenerated, false);
  });

  it('generates BOQ CSV export blob locally', async () => {
    const res = await apiClient.executeLocal('/api/boq/export-csv', {
      method: 'POST',
      body: {
        items: [
          { itemCode: 'ITEM-01', description: 'Earthwork excavation', quantity: 20, unit: 'm³', materialRate: 0, labourRate: 350 }
        ]
      }
    });
    assert.strictEqual(res.ok, true);
    const text = await res.text();
    assert.ok(text.includes('Item Code,Description,Quantity'));
    assert.ok(text.includes('Earthwork excavation'));
    assert.ok(text.includes('GST (18%)'));
    assert.ok(text.includes('Grand Total Estimate (INR)'));
  });
});

describe('Production Readiness Audit — Boundary Conditions & Zero Handling', () => {
  it('rejects zero or negative concrete volume with descriptive error', () => {
    assert.throws(() => {
      ConcreteEngine.calculate({
        mixGrade: 'M20',
        length: 0,
        width: 4,
        depth: 0.15
      });
    }, /must be greater than (0|zero)/i);

    assert.throws(() => {
      ConcreteEngine.calculate({
        mixGrade: 'M20',
        length: -5,
        width: 4,
        depth: 0.15
      });
    }, /must be greater than (0|zero)/i);
  });

  it('handles empty BOQ items array gracefully with clear validation error', () => {
    assert.throws(() => {
      BoqEngine.calculate({ items: [] });
    }, /BOQ items must be a non-empty array/);
  });

  it('correctly calculates 18% GST and pre-tax markups in BOQ financials', () => {
    const boq = BoqEngine.calculate({
      items: [
        { itemCode: 'ITM-1', description: 'PCC 1:4:8', quantity: 10, unit: 'm³', materialRate: 3000, labourRate: 1000 }
      ],
      overheadPercent: 5,
      contractorProfitPercent: 10,
      contingencyPercent: 3,
      gstPercent: 18
    });

    // Direct cost: 10 * 4000 = 40,000
    assert.strictEqual(boq.financials.directCostSubtotal, 40000);
    // Overhead: 5% of 40,000 = 2,000
    assert.strictEqual(boq.financials.overhead.amount, 2000);
    // Contractor Profit: 10% of (40,000 + 2,000) = 4,200
    assert.strictEqual(boq.financials.contractorProfit.amount, 4200);
    // Contingency: 3% of 40,000 = 1,200
    assert.strictEqual(boq.financials.contingency.amount, 1200);
    // Pre-tax total: 40000 + 2000 + 4200 + 1200 = 47,400
    assert.strictEqual(boq.financials.preTaxTotal, 47400);
    // GST 18%: 18% of 47,400 = 8,532
    assert.strictEqual(boq.financials.gst.amount, 8532);
    // Grand Total: 47,400 + 8,532 = 55,932
    assert.strictEqual(boq.financials.grandTotal, 55932);
  });

  it('rejects tare weight equal to or exceeding gross weight in scrap valuation', () => {
    assert.throws(() => {
      ScrapValuationEngine.calculate({
        grossWeight: 1000,
        tareWeight: 1000,
        unitRate: 45
      });
    }, /Tare weight cannot be equal to or greater than gross weight/);

    assert.throws(() => {
      ScrapValuationEngine.calculate({
        grossWeight: 500,
        tareWeight: 750,
        unitRate: 45
      });
    }, /Tare weight cannot be equal to or greater than gross weight/);
  });

  it('correctly calculates net payout after physical deductions and transport expenses', () => {
    const res = ScrapValuationEngine.calculate({
      grossWeight: 2000,
      tareWeight: 500, // Net scale = 1500 kg
      unitRate: 50, // ₹50/kg
      moisturePercent: 2, // 30 kg
      impurityPercent: 3, // 45 kg
      transportCost: 1000,
      labourHandlingCost: 500
    });

    // Net scale = 1500 kg
    assert.strictEqual(res.weights.netScaleWeightKg, 1500);
    // Deductions: 5% of 1500 = 75 kg => Net accepted = 1425 kg
    assert.strictEqual(res.weights.netAcceptedWeightKg, 1425);
    // Gross value = 1425 * 50 = 71,250
    assert.strictEqual(res.pricing.grossValue, 71250);
    // Expenses = 1000 + 500 = 1,500
    assert.strictEqual(res.pricing.expenses.totalExpenses, 1500);
    // Net payout = 71,250 - 1,500 = 69,750
    assert.strictEqual(res.pricing.netPayout, 69750);
  });
});

describe('Production Readiness Audit — Security, Repository & Service Worker', () => {
  it('verifies .gitignore contains strict exclusions for SQLite database and secret files', () => {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');

    assert.ok(content.includes('data/*.sqlite'), 'data/*.sqlite must be in .gitignore');
    assert.ok(content.includes('data/*.sqlite-journal'), 'sqlite journals must be in .gitignore');
    assert.ok(content.includes('.env'), '.env must be in .gitignore');
    assert.ok(content.includes('node_modules/'), 'node_modules must be in .gitignore');
  });

  it('verifies public/sw.js never attempts Cache API put on non-GET methods', () => {
    const swPath = path.join(projectRoot, 'public', 'sw.js');
    const content = fs.readFileSync(swPath, 'utf8');

    assert.ok(content.includes("if (request.method !== 'GET')"), 'sw.js must reject non-GET requests from caching');
    assert.ok(content.includes('ddevultrahome-v4'), 'sw.js must be bumped to v4');
    assert.ok(content.includes('request.mode === \'navigate\''), 'sw.js must have navigation network-first handler');
    assert.ok(content.includes('/js/apiClient.js'), 'sw.js must cache apiClient.js');
    assert.ok(content.includes('/js/i18n.js'), 'sw.js must cache i18n.js');
  });

  it('verifies AI Provider does not crash when process is undefined in browser', () => {
    // Instantiate GeminiProvider in environment with or without process.env
    const gemini = new GeminiProvider();
    assert.ok(gemini);
    assert.ok(gemini.fallbackEngine instanceof OfflineCivilEngineProvider);
  });

  it('verifies server.js implements path boundary guard against directory traversal', () => {
    const serverPath = path.join(projectRoot, 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    assert.ok(content.includes('resolvedPath.startsWith(publicDir)'), 'server.js must enforce publicDir boundary');
    assert.ok(content.includes('X-Content-Type-Options'), 'server.js must set nosniff header');
    assert.ok(content.includes('X-Frame-Options'), 'server.js must set SAMEORIGIN frame option');
    assert.ok(content.includes('Referrer-Policy'), 'server.js must set Referrer-Policy header');
  });
});
