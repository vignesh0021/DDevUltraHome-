import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Engine Imports
import { ConcreteEngine } from '../src/engine/concrete.js';
import { RccEngine } from '../src/engine/rcc.js';
import { MasonryEngine } from '../src/engine/masonry.js';
import { FinishingEngine } from '../src/engine/finishing.js';
import { EarthworkEngine } from '../src/engine/earthwork.js';
import { BbsEngine } from '../src/engine/bbs.js';
import { WaterTankEngine } from '../src/engine/watertank.js';
import { SepticTankEngine } from '../src/engine/septictank.js';
import { GeotechEngine } from '../src/engine/geotech.js';
import { ConcreteQcEngine } from '../src/engine/qc.js';
import { AntiTermiteEngine } from '../src/engine/antitermite.js';
import { TncdbrEngine } from '../src/engine/tncdbr.js';
import { MBookEngine } from '../src/engine/mbook.js';
import { LabourEngine } from '../src/engine/labour.js';
import { RwhEngine } from '../src/engine/rwh.js';
import { DurabilityEngine } from '../src/engine/durability.js';
import { CmdaFeeEngine } from '../src/engine/cmdafee.js';
import { PlinthEngine } from '../src/engine/plinth.js';
import { PileEngine } from '../src/engine/pile.js';
import { BoqEngine } from '../src/engine/boq.js';
import { MilestonesEngine } from '../src/engine/milestones.js';

// Intelligence & AI Imports
import { TN_DISTRICTS, DISTRICT_PRICE_INDEX, MaterialPriceIntelligence } from '../src/intelligence/materialRates.js';
import { ScrapRatesEngine } from '../src/intelligence/scrapRates.js';
import { ScrapValuationEngine } from '../src/intelligence/scrapValuation.js';
import {
  PriceProviderRegistry,
  OfficialPwdSorProvider,
  DealerQuotationProvider,
  OfflineReferenceProvider,
  PriceProvenance
} from '../src/intelligence/providerArchitecture.js';
import {
  AiService,
  OfflineCivilEngineProvider,
  GeminiProvider,
  GroqProvider,
  OpenRouterProvider,
  CustomEndpointProvider
} from '../src/ai/provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Full Civil Engineering Calculator Verification (All 19 Engines)', () => {

  // 1. Concrete Mix Engine
  it('1. Concrete Mix: M20 batch for 10 m³ produces theoretical materials per IS 456', () => {
    const res = ConcreteEngine.calculate({ volumeM3: 10, mixGrade: 'M20', wastagePercent: 2 });
    assert.equal(res.wetVolumeM3, 10);
    // 10 * 1.54 * 1.02 = 15.708 dry volume
    // M20 (1:1.5:3, sum 5.5): cement = 15.708/5.5 * 1440 = 4112.64 kg -> ~82-83 bags
    assert.ok(res.materials.cement.bagsRounded >= 82 && res.materials.cement.bagsRounded <= 84);
    assert.ok(res.materials.sand.tnUnits > 1.2 && res.materials.sand.tnUnits < 1.6);
    assert.ok(res.materials.aggregate.tnUnits > 2.5 && res.materials.aggregate.tnUnits < 3.2);
  });

  // 2. RCC Structural Elements (Slab, Beam, Column, Footing)
  it('2. RCC Elements: Sizes slabs, beams, columns, and footings correctly', () => {
    // Two-way slab 5m x 4m, 125mm thick
    const slab = RccEngine.calculateSlab({ length: 5, width: 4, thickness: 125, thicknessUnit: 'mm', steelPercentage: 0.8 });
    assert.ok(slab.slabType.includes('Two-Way'));
    assert.equal(slab.concreteVolumeM3, 2.5); // 5 * 4 * 0.125
    assert.ok(slab.steel.weightKg > 150 && slab.steel.weightKg < 165); // 2.5 * 0.008 * 7850 = 157 kg

    // Beam 4m span, 230mm x 450mm
    const beam = RccEngine.calculateBeam({ span: 4, width: 230, depth: 450, dimensionUnit: 'mm', steelPercentage: 1.5 });
    assert.ok(beam.concreteVolumeM3 > 0.40 && beam.concreteVolumeM3 < 0.43); // 4 * 0.23 * 0.45 = 0.414 m³
    assert.ok(beam.steel.weightKg > 45 && beam.steel.weightKg < 55); // 0.414 * 0.015 * 7850 = 48.7 kg

    // Column 3m height, 230mm x 450mm
    const col = RccEngine.calculateColumn({ height: 3, width: 230, depth: 450, steelPercentage: 2.0 });
    assert.ok(col.concreteVolumeM3 > 0.30 && col.concreteVolumeM3 < 0.33); // 3 * 0.23 * 0.45 = 0.3105 m³

    // Footing 1.5m x 1.5m, 450mm depth
    const foot = RccEngine.calculateFooting({ length: 1.5, width: 1.5, depth: 450 });
    assert.ok(foot.concreteVolumeM3 > 1.0 && foot.concreteVolumeM3 < 1.05); // 1.5 * 1.5 * 0.45 = 1.0125 m³
  });

  // 3. Masonry Engine
  it('3. Masonry: Computes country brick masonry and mortar take-off accurately', () => {
    // 5m length x 3m height, 230mm wall, 1 opening of 1.2m x 2.1m (2.52 m²)
    const res = MasonryEngine.calculate({
      wallLength: 5,
      wallHeight: 3,
      wallThicknessMm: 230,
      mortarMix: '1:5',
      deductions: 2.52,
      brickWastagePercent: 5
    });
    assert.ok(res.materials.bricks.countRequired > 1300 && res.materials.bricks.countRequired < 1700);
    assert.ok(res.materials.mortar.cementBags >= 5 && res.materials.mortar.cementBags <= 8);
  });

  // 4. Finishing Works Engine (Plaster, Paint, Tiles)
  it('4. Finishing Works: Computes plastering, painting, and vitrified tiles', () => {
    // 12mm internal plastering for 100 m²
    const plaster = FinishingEngine.calculatePlaster({ areaM2: 100, thicknessMm: 12, mixRatio: '1:4' });
    assert.ok(plaster.materials.cementBags >= 8 && plaster.materials.cementBags <= 12);
    assert.ok(plaster.materials.sandTnUnits > 0.3 && plaster.materials.sandTnUnits < 0.7);

    // Painting 100 m²
    const paint = FinishingEngine.calculatePainting({ areaM2: 100, coats: 2 });
    assert.ok(paint.materials.puttyKg >= 60 && paint.materials.puttyKg <= 90);
    assert.ok(paint.materials.emulsionPaintLitres >= 12 && paint.materials.emulsionPaintLitres <= 20);

    // Vitrified Tiles 50 m²
    const tiles = FinishingEngine.calculateFlooring({ areaM2: 50, tileType: 'VITRIFIED_600x600' });
    assert.ok(tiles.materials.tilesCount >= 30 && tiles.materials.tilesCount <= 45);
  });

  // 5. Earthwork & Excavation
  it('5. Earthwork: Calculates pit excavation and loose bulking volume', () => {
    const ew = EarthworkEngine.calculate({ length: 10, width: 5, depth: 2, soilType: 'ORDINARY_SOIL', bulkingFactor: 1.25 });
    assert.equal(ew.excavationVolumeM3, 100);
    assert.equal(ew.looseVolumeM3, 125);
    assert.ok(ew.lorryLoads10Ton >= 15 && ew.lorryLoads10Ton <= 25);
  });

  // 6. BBS / Stirrup Engine
  it('6. BBS Stirrup: Calculates cutting length with IS 2502 bend deductions', () => {
    // Beam 230mm x 450mm, 25mm cover, 8mm stirrup, 135° seismic hook
    const bbs = BbsEngine.calculateStirrup({ beamWidthMm: 230, beamDepthMm: 450, coverMm: 25, stirrupBarDiaMm: 8, hookAngleDeg: 135 });
    assert.ok(bbs.cuttingLengthMm > 1200 && bbs.cuttingLengthMm < 1450);
    assert.ok(bbs.weightPerStirrupKg > 0.45 && bbs.weightPerStirrupKg < 0.65);
    assert.equal(bbs.hookExtensionMm, 80); // 10d = 80mm
  });

  // 7. Water Tank & Demand Engine
  it('7. Water Tank: Sizes domestic sump and IS 1172 water demand', () => {
    const tank = WaterTankEngine.calculateCapacity({ lengthM: 3, widthM: 2, waterDepthM: 1.5, personsCount: 5, tankType: 'UNDERGROUND_SUMP' });
    assert.equal(tank.actualCapacityLitres, 9000); // 3 * 2 * 1.5 * 1000 = 9000 L
    assert.ok(tank.estimatedDemandLitres >= 1200 && tank.estimatedDemandLitres <= 1500); // 5 persons * 135 L/head * 2 days = 1350 L
  });

  // 8. Septic Tank Engine (IS 2470)
  it('8. Septic Tank: Sizes tank dimensions per IS 2470 for 10 users', () => {
    const res = SepticTankEngine.calculate({ users: 10, cleaningIntervalYears: 2, wasteStream: 'WC_AND_SULLAGE' });
    assert.ok(res.recommendedLengthM >= 1.4 && res.recommendedLengthM <= 2.5);
    assert.ok(res.recommendedWidthM >= 0.5 && res.recommendedWidthM <= 1.2);
    assert.ok(res.totalCapacityLitres >= 1200 && res.totalCapacityLitres <= 3000);
  });

  // 9. Geotechnical SBC Footing (IS 1904)
  it('9. Geotech Footing: Sizes isolated footing for 600 kN column on 150 kN/m² soil', () => {
    const res = GeotechEngine.sizeFooting({ columnAxialLoadKn: 600, sbcKnm2: 150, columnSizeMm: 300 });
    // Total design load with 10% self-weight = 660 kN / 150 = 4.40 m²
    assert.ok(res.requiredAreaM2 >= 4.3 && res.requiredAreaM2 <= 4.5);
    assert.ok(res.footingLengthM >= 2.0 && res.footingLengthM <= 2.2);
  });

  // 10. Concrete QC Cube Test (IS 516 / IS 456)
  it('10. Concrete QC: Evaluates 3 specimen compressive strengths accurately', () => {
    // 3 cubes with failure loads 500 kN, 520 kN, 495 kN on 150mm face (area 22,500 mm²)
    // 500,000 / 22,500 = 22.22 N/mm²
    const res = ConcreteQcEngine.evaluateBatch({ mixGrade: 'M20', testAgeDays: 28, breakingLoadsKn: [500, 520, 495] });
    assert.equal(res.isCompliant, true);
    assert.ok(res.averageStrengthNmm2 > 22.0 && res.averageStrengthNmm2 < 23.5);
  });

  // 11. Anti-Termite Pre-Construction (IS 6313)
  it('11. Anti-Termite: Estimates chemical and emulsion for 1000 sq.ft plinth', () => {
    const res = AntiTermiteEngine.calculate({ plinthAreaSqft: 1000, chemical: 'CHLORPYRIFOS_20EC' });
    assert.ok(res.totalEmulsionLitres > 1000 && res.totalEmulsionLitres < 2000);
    assert.ok(res.concentratedChemicalLitres > 50 && res.concentratedChemicalLitres < 100);
    assert.ok(res.cans5LitreRequired >= 10);
  });

  // 12. TNCDBR 2019 Planning Rules
  it('12. TNCDBR 2019: Validates residential setbacks and FSI on 2400 sq.ft plot', () => {
    const res = TncdbrEngine.validateResidentialPlan({ plotAreaSqft: 2400, roadWidthM: 9.1, buildingHeightM: 7.0, category: 'RESIDENTIAL' });
    assert.equal(res.permissibleFsi, 1.75);
    assert.ok(res.setbacks.frontM >= 1.5);
    assert.ok(res.maxBuiltupAreaSqft >= 4000);
  });

  // 13. M-Book & RA Billing
  it('13. M-Book: Computes exact item quantities and generates progressive RA bill', () => {
    const entries = [
      { nos: 2, lengthM: 5, breadthM: 0.23, depthM: 0.45, unitRate: 7500 },
      { nos: 4, lengthM: 3, breadthM: 0.23, depthM: 0.45, unitRate: 7500 }
    ];
    const qtyRes = MBookEngine.calculateItemQuantity(entries);
    assert.ok(qtyRes.totalQuantity > 2.0 && qtyRes.totalQuantity < 2.5);

    const bill = MBookEngine.generateRaBill({
      billNumber: 'RA Bill No. 2',
      previousGrossCertified: 200000,
      billItems: [
        { description: 'RCC M20 Casting', quantitySinceLastBill: 100, unit: 'm³', rate: 4500 }
      ],
      retentionPercent: 5.0,
      tdsPercent: 1.0,
      labourCessPercent: 1.0
    });
    assert.equal(bill.financials.currentBillGrossValue, 450000);
    assert.equal(bill.financials.deductions.retentionMoney.amount, 22500);
    assert.equal(bill.financials.deductions.tdsSec194C.amount, 4500);
    assert.equal(bill.financials.netPayableToContractor, 418500);
  });

  // 14. Labour Norms Engine
  it('14. Labour Norms: Computes mason and helper man-days per TN PWD norms', () => {
    const res = LabourEngine.calculate({ activityKey: 'BRICK_MASONRY_M3', quantity: 10 });
    assert.equal(res.quantity, 10);
    assert.ok(res.totalManDays > 0);
    assert.ok(res.totalLabourCost > 0);
  });

  // 15. Rainwater Harvesting (RWH) Sizer
  it('15. RWH: Sizes recharge well for 1500 sq.ft roof per TNCDBR Rule 42', () => {
    const res = RwhEngine.calculate({ roofAreaSqft: 1500, pavedAreaSqft: 600, soilPercolation: 'LOW' });
    assert.ok(res.annualPotentialLitres > 100000);
    assert.equal(res.complianceStatus, 'COMPLIANT_TNCDBR_RULE_42');
  });

  // 16. Coastal Durability Controller
  it('16. Durability: Applies marine severe exposure norms within 5km from Chennai beach', () => {
    const res = DurabilityEngine.evaluate({
      exposureCondition: 'SEVERE',
      proposedGrade: 'M30',
      proposedCoverMm: 45,
      elementType: 'BEAM',
      waterCementRatio: 0.44
    });
    assert.equal(res.complianceStatus, 'DURABILITY_COMPLIANT');
    assert.equal(res.specifications.minimumConcreteGrade, 'M30');
    assert.equal(res.specifications.mandatoryNominalCoverMm, 45);
  });

  // 17. CMDA & GCC Approval Fees
  it('17. CMDA Fees: Estimates statutory approval charges for 1800 sq.ft residential house', () => {
    const res = CmdaFeeEngine.estimateFees({
      plotAreaSqft: 2400,
      totalBuiltupSqft: 2600,
      locationZone: 'GCC_CORE',
      estimatedCostPerSqft: 2500
    });
    assert.ok(res.totalStatutoryAmount > 150000);
    assert.ok(res.feeBreakdown.labourWelfareCess1Pct.amount > 50000);
  });

  // 18. Flood Plinth Height & DPC
  it('18. Flood Plinth: Recommends safe finished floor height in flood prone zone', () => {
    const safePlinth = PlinthEngine.calculate({
      plinthAreaSqft: 1200,
      plinthHeightAboveRoadMm: 750
    });
    assert.equal(safePlinth.plinthLevelStatus, 'COMPLIANT_POST_MICHAUNG_STANDARD');
    assert.ok(safePlinth.fillMaterials.looseMoorumM3 > 0);
  });

  // 19. Under-Reamed Piles (IS 2911 Part 3)
  it('19. Under-Reamed Pile: Computes safe pile load on black cotton soil', () => {
    const res = PileEngine.calculate({ columnLoadKn: 400, shaftDiameterMm: 300, numberOfBulbs: 2, pileLengthM: 4.5 });
    assert.ok(res.safeLoadCapacityKn > 150 && res.safeLoadCapacityKn < 300);
    assert.equal(res.bulbDiameterMm, 750); // 2.5 * 300mm = 750mm
    assert.ok(res.pilesCountRequired >= 2);
  });
});

describe('Tamil Nadu Canonical 38 Districts Verification', () => {
  it('asserts exactly 38 unique districts in TN_DISTRICTS catalog', () => {
    assert.equal(TN_DISTRICTS.length, 38);
    const unique = new Set(TN_DISTRICTS);
    assert.equal(unique.size, 38);
  });

  it('asserts every district has a verified positive price logistics index', () => {
    for (const dist of TN_DISTRICTS) {
      const idx = DISTRICT_PRICE_INDEX[dist];
      assert.ok(typeof idx === 'number', `Missing index for ${dist}`);
      assert.ok(idx >= 0.85 && idx <= 1.25, `Index out of realistic bounds for ${dist}: ${idx}`);
    }
  });

  it('asserts public/index.html includes all 38 districts in select dropdown', () => {
    const html = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf-8');
    for (const dist of TN_DISTRICTS) {
      assert.ok(html.includes(`value="${dist}"`), `Missing district option ${dist} in index.html`);
    }
  });
});

describe('Price Provider Architecture & Settings Suite', () => {
  it('loads all 4 price providers with valid metadata and provenance tags', () => {
    const registry = new PriceProviderRegistry();
    const providers = registry.getProviders();
    assert.equal(providers.length, 4);

    const ids = providers.map(p => p.id);
    assert.ok(ids.includes('pwd_sor'));
    assert.ok(ids.includes('dealer_quote'));
    assert.ok(ids.includes('public_api'));
    assert.ok(ids.includes('offline_reference'));
  });

  it('correctly switches provider and adjusts district pricing', async () => {
    const registry = new PriceProviderRegistry();
    registry.setActiveProvider('pwd_sor');
    const pwdRates = await registry.getRates('Chennai');
    assert.ok(pwdRates.length > 0);
    assert.equal(pwdRates[0].provenance, PriceProvenance.OFFICIAL_PWD_SOR);

    registry.setActiveProvider('dealer_quote');
    const dealerRates = await registry.getRates('Chennai');
    assert.ok(dealerRates.length > 0);
    assert.equal(dealerRates[0].provenance, PriceProvenance.DEALER_QUOTATION);
  });

  it('exports and imports custom contractor rates without data loss', () => {
    const registry = new PriceProviderRegistry();
    registry.customOverrides = {
      'MAT-CEM-OPC53': { price: 420.00 }
    };
    const exported = registry.exportCustomRates();
    assert.ok(exported.includes('420'));

    const newRegistry = new PriceProviderRegistry();
    const importRes = newRegistry.importCustomRates(exported);
    assert.equal(importRes.ok, true);
    assert.equal(newRegistry.customOverrides['MAT-CEM-OPC53'].price, 420.00);
  });

  it('flushes local cache cleanly', () => {
    const registry = new PriceProviderRegistry();
    registry.customOverrides = { 'TEST': 123 };
    const flushRes = registry.flushCache();
    assert.equal(flushRes.ok, true);
    assert.equal(Object.keys(registry.customOverrides).length, 0);
  });
});

describe('Multi-Provider AI Assistant & Key Redaction Suite', () => {
  it('redacts and masks private API keys in client config output', () => {
    const ai = new AiService();
    ai.configure({ provider: 'gemini', apiKey: 'AIzaSyDemoSecretKeyForTesting123' }, false);
    const cfg = ai.getConfig();
    assert.equal(cfg.activeProvider, 'gemini');
    assert.equal(cfg.hasKey, true);
    assert.ok(!cfg.maskedKey.includes('DemoSecretKey'));
    assert.ok(cfg.maskedKey.startsWith('AIza...'));
  });

  it('strictly falls back to deterministic offline civil engine when offline or no key', async () => {
    const ai = new AiService();
    ai.configure({ provider: 'offline', disabled: true }, false);
    const res = await ai.ask('What is the mix ratio of M20 concrete?');
    assert.equal(res.isAiGenerated, false);
    assert.ok(res.answer.includes('1 : 1.5 : 3'));
    assert.ok(res.references && res.references.length > 0);
  });
});

describe('Mobile Viewport & Touch Target CSS Verification', () => {
  it('verifies style.css contains 48px min-height for form controls and touch targets', () => {
    const css = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');
    assert.ok(css.includes('min-height: 48px;'), 'style.css must specify 48px minimum touch height');
    assert.ok(css.includes('font-size: 1rem;'), 'style.css must specify 1rem font-size to prevent Android browser zoom');
    assert.ok(css.includes('env(safe-area-inset-bottom'), 'style.css must handle safe-area-inset-bottom');
  });

  it('verifies capacitor.config.json has webContentsDebuggingEnabled disabled for production', () => {
    const cap = JSON.parse(fs.readFileSync(path.join(rootDir, 'capacitor.config.json'), 'utf-8'));
    assert.equal(cap.android.webContentsDebuggingEnabled, false);
  });
});
