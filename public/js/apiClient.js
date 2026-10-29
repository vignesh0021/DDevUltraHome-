/**
 * DDevUltraHome Unified API Client & Offline Dispatcher
 * Seamlessly routes API requests to Node.js backend when online,
 * or dispatches directly to pure ESM calculation engines in Capacitor Android WebView & Offline PWA.
 *
 * Guarantees 100% offline capability, zero calculation loss, and identical response contracts.
 */

import { ConcreteEngine } from './engine/concrete.js';
import { RccEngine } from './engine/rcc.js';
import { MasonryEngine } from './engine/masonry.js';
import { FinishingEngine } from './engine/finishing.js';
import { EarthworkEngine } from './engine/earthwork.js';
import { BbsEngine } from './engine/bbs.js';
import { WaterTankEngine } from './engine/watertank.js';
import { LabourEngine } from './engine/labour.js';
import { BoqEngine } from './engine/boq.js';
import { SepticTankEngine } from './engine/septictank.js';
import { MilestonesEngine } from './engine/milestones.js';
import { GeotechEngine } from './engine/geotech.js';
import { ConcreteQcEngine } from './engine/qc.js';
import { TncdbrEngine } from './engine/tncdbr.js';
import { MBookEngine } from './engine/mbook.js';
import { AntiTermiteEngine } from './engine/antitermite.js';
import { RwhEngine } from './engine/rwh.js';
import { DurabilityEngine } from './engine/durability.js';
import { CmdaFeeEngine } from './engine/cmdafee.js';
import { PlinthEngine } from './engine/plinth.js';
import { PileEngine } from './engine/pile.js';
import { MaterialPriceIntelligence, TN_DISTRICTS } from './intelligence/materialRates.js';
import { ScrapRatesEngine } from './intelligence/scrapRates.js';
import { OfflineCivilEngineProvider, aiService } from './ai/provider.js';
import { defaultProviderRegistry } from './intelligence/providerArchitecture.js';
import { BoqGenerator } from './plan/boqGenerator.js';
import { MaterialProcurementEngine } from './plan/materialProcurement.js';
import { TakeoffEngine } from './plan/takeoffEngine.js';
import { ExcelExportEngine } from './plan/excelExport.js';
import { PdfExtractor } from './plan/pdfExtractor.js';

// --- Local Storage Database Emulation (for Standalone APK / Offline PWA) ---
const STORAGE_KEYS = {
  PROJECTS: 'ddev_projects_v1',
  ESTIMATES: 'ddev_estimates_v1',
  SCRAP: 'ddev_scrap_settlements_v1'
};

function getStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

const offlineCivilAi = new OfflineCivilEngineProvider();

/**
 * Creates a standard Response-like object compatible with fetch()
 */
function createMockResponse(data, status = 200, contentType = 'application/json') {
  const isString = typeof data === 'string';
  const textContent = isString ? data : JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null)
    },
    json: async () => (isString ? JSON.parse(data) : data),
    text: async () => textContent,
    blob: async () => new Blob([textContent], { type: contentType })
  };
}

/**
 * Direct execution of engine calculations in-process
 */
async function executeLocalRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let body = {};
  if (options.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch (e) {
      body = {};
    }
  }

  // Parse URL pathname and search parameters
  let pathname = url;
  let searchParams = new URLSearchParams();
  if (url.includes('?')) {
    const parts = url.split('?');
    pathname = parts[0];
    searchParams = new URLSearchParams(parts[1]);
  }

  try {
    // 1. Health & System
    if (pathname === '/api/health') {
      return createMockResponse({
        status: 'UP',
        appName: 'DDevUltraHome',
        version: '1.0.0',
        runtime: 'Client ESM Engine (Standalone / Capacitor / Offline)',
        region: 'Tamil Nadu, India',
        standards: ['IS 456', 'IS 1200', 'IS 2502', 'TN PWD SOR 2025-26']
      });
    }

    if (pathname === '/api/districts') {
      return createMockResponse({ districts: TN_DISTRICTS });
    }

    // 2. Material Rates Intelligence
    if (pathname === '/api/rates') {
      const district = searchParams.get('district') || 'Chennai';
      const rates = MaterialPriceIntelligence.getRatesForDistrict(district);
      return createMockResponse({ district, rates });
    }

    // 3. Scrap Intelligence & Valuation
    if (pathname === '/api/scrap/rates') {
      const rates = ScrapRatesEngine.getAllRates();
      return createMockResponse({ rates });
    }

    if (pathname === '/api/scrap/calculate') {
      const result = ScrapValuationEngine.calculate(body);
      return createMockResponse(result);
    }

    if (pathname === '/api/scrap/save') {
      const settlements = getStorage(STORAGE_KEYS.SCRAP);
      const id = 'scrap_' + Date.now();
      settlements.unshift({ id, ...body, createdAt: new Date().toISOString() });
      setStorage(STORAGE_KEYS.SCRAP, settlements);
      return createMockResponse({ success: true, id });
    }

    if (pathname === '/api/scrap/settlements') {
      const settlements = getStorage(STORAGE_KEYS.SCRAP);
      return createMockResponse({ settlements });
    }

    // 4. Civil Calculation Engines
    if (pathname === '/api/calculate/concrete') {
      return createMockResponse(ConcreteEngine.calculate(body));
    }

    if (pathname === '/api/calculate/rcc') {
      const type = (body.elementType || 'SLAB').toUpperCase();
      let result;
      if (type === 'SLAB') result = RccEngine.calculateSlab(body);
      else if (type === 'BEAM') result = RccEngine.calculateBeam(body);
      else if (type === 'COLUMN') result = RccEngine.calculateColumn(body);
      else if (type === 'FOOTING') result = RccEngine.calculateFooting(body);
      else if (type === 'STAIRCASE') result = RccEngine.calculateStaircase(body);
      else throw new Error(`Unknown RCC element type: ${type}`);
      return createMockResponse(result);
    }

    if (pathname === '/api/calculate/masonry') {
      return createMockResponse(MasonryEngine.calculate(body));
    }

    if (pathname === '/api/calculate/finishing') {
      const type = (body.finishingType || body.type || 'PLASTER').toUpperCase();
      let result;
      if (type === 'PLASTER') result = FinishingEngine.calculatePlaster(body);
      else if (type === 'PAINT') result = FinishingEngine.calculatePainting(body);
      else if (type === 'FLOORING' || type === 'TILES') result = FinishingEngine.calculateFlooring(body);
      else throw new Error(`Unknown finishing type: ${type}`);
      return createMockResponse(result);
    }

    if (pathname === '/api/calculate/earthwork') {
      return createMockResponse(EarthworkEngine.calculate(body));
    }

    if (pathname === '/api/calculate/bbs') {
      let result;
      if (body.type === 'STIRRUP' || body.beamWidthMm || body.memberWidthMm || !body.scheduleEntries) {
        result = BbsEngine.calculateStirrup(body);
      } else {
        result = BbsEngine.generateSchedule(body.scheduleEntries || []);
      }
      return createMockResponse(result);
    }

    if (pathname === '/api/calculate/watertank') {
      return createMockResponse(WaterTankEngine.calculateCapacity(body));
    }

    if (pathname === '/api/calculate/labour') {
      return createMockResponse(LabourEngine.calculate(body));
    }

    if (pathname === '/api/calculate/boq') {
      return createMockResponse(BoqEngine.calculate(body));
    }

    if (pathname === '/api/calculate/septictank') {
      return createMockResponse(SepticTankEngine.calculate(body));
    }

    if (pathname === '/api/calculate/milestones') {
      return createMockResponse(MilestonesEngine.calculateSchedule(body.totalContractAmount, body.customStages));
    }

    if (pathname === '/api/calculate/sbc-footing') {
      return createMockResponse(GeotechEngine.sizeFooting(body));
    }

    if (pathname === '/api/qc/cube-test') {
      return createMockResponse(ConcreteQcEngine.evaluateBatch(body));
    }

    if (pathname === '/api/planning/tncdbr') {
      return createMockResponse(TncdbrEngine.validateResidentialPlan(body));
    }

    if (pathname === '/api/mbook/calculate') {
      return createMockResponse(MBookEngine.calculateItemQuantity(body.entries || body.items || []));
    }

    if (pathname === '/api/mbook/ra-bill') {
      return createMockResponse(MBookEngine.generateRaBill(body));
    }

    if (pathname === '/api/calculate/antitermite') {
      return createMockResponse(AntiTermiteEngine.calculate(body));
    }

    if (pathname === '/api/calculate/rwh') {
      return createMockResponse(RwhEngine.calculate(body));
    }

    if (pathname === '/api/durability/check') {
      return createMockResponse(DurabilityEngine.evaluate(body));
    }

    if (pathname === '/api/planning/cmda-fee') {
      return createMockResponse(CmdaFeeEngine.estimateFees(body));
    }

    if (pathname === '/api/calculate/plinth') {
      return createMockResponse(PlinthEngine.calculate(body));
    }

    if (pathname === '/api/calculate/pile') {
      return createMockResponse(PileEngine.calculate(body));
    }

    // 5. AI Assistant & Multi-Provider Architecture
    if (pathname === '/api/ai/ask') {
      const response = await aiService.ask(body.prompt || '', body.context || {});
      return createMockResponse(response);
    }

    if (pathname === '/api/ai/config') {
      if (options.method === 'POST') {
        aiService.configure(body);
        return createMockResponse({ success: true, config: aiService.getConfig() });
      }
      return createMockResponse(aiService.getConfig());
    }

    if (pathname === '/api/ai/test') {
      const result = await aiService.testConnection();
      return createMockResponse(result);
    }

    // 5b. Price Providers Architecture
    if (pathname === '/api/providers') {
      return createMockResponse({
        providers: defaultProviderRegistry.getProviders(),
        activeProvider: defaultProviderRegistry.activeProviderId
      });
    }

    if (pathname === '/api/providers/set') {
      defaultProviderRegistry.setActiveProvider(body.providerId);
      if (body.customUrl) defaultProviderRegistry.setCustomEndpoint(body.customUrl);
      return createMockResponse({ success: true });
    }

    if (pathname === '/api/providers/test') {
      const res = await defaultProviderRegistry.testActiveConnection();
      return createMockResponse(res);
    }

    if (pathname === '/api/providers/flush-cache') {
      const res = defaultProviderRegistry.flushCache();
      return createMockResponse(res);
    }

    // 6. BOQ CSV Export
    if (pathname === '/api/boq/export-csv') {
      const boq = BoqEngine.calculate(body);
      let csv = 'Item Code,Description,Quantity,Unit,Material Rate (INR),Labour Rate (INR),Total Unit Rate (INR),Item Total (INR)\r\n';
      for (const itm of boq.items) {
        const desc = `"${(itm.description || '').replace(/"/g, '""')}"`;
        csv += `${itm.itemCode},${desc},${itm.quantity},${itm.unit},${itm.materialRate},${itm.labourRate},${itm.unitRate},${itm.totalAmount}\r\n`;
      }
      csv += `\r\nDirect Civil Works Subtotal,,,,,,,${boq.financials.directCostSubtotal}\r\n`;
      csv += `Site Overhead (5%),,,,,,,${boq.financials.overhead.amount}\r\n`;
      csv += `Contractor Profit (10%),,,,,,,${boq.financials.contractorProfit.amount}\r\n`;
      csv += `Contingency (3%),,,,,,,${boq.financials.contingency.amount}\r\n`;
      csv += `GST (18%),,,,,,,${boq.financials.gst.amount}\r\n`;
      csv += `Grand Total Estimate (INR),,,,,,,${boq.financials.grandTotal}\r\n`;
      return createMockResponse(csv, 200, 'text/csv');
    }

    // 6b. Plan to Budget & Takeoff Engine (In-Process Dispatcher)
    if (pathname === '/api/plan-budget/parse-plan') {
      let buffer;
      if (body.fileBase64) {
        if (typeof Buffer !== 'undefined') {
          buffer = Buffer.from(body.fileBase64, 'base64');
        } else {
          const binary = atob(body.fileBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          buffer = bytes;
        }
      } else if (body.rawText) {
        buffer = typeof Buffer !== 'undefined' ? Buffer.from(body.rawText, 'utf-8') : new TextEncoder().encode(body.rawText);
      } else {
        return createMockResponse({ success: false, error: 'Missing fileBase64 or rawText in request body' }, 400);
      }
      const result = typeof PdfExtractor.extractPlanAsync === 'function'
        ? await PdfExtractor.extractPlanAsync(buffer, {
            fileName: body.fileName || 'plan.pdf',
            mimeType: body.mimeType || 'application/pdf'
          })
        : PdfExtractor.extractPlan(buffer, {
            fileName: body.fileName || 'plan.pdf',
            mimeType: body.mimeType || 'application/pdf'
          });
      return createMockResponse({ success: true, ...result });
    }

    if (pathname === '/api/plan-budget/calibrate-scale') {
      const scale = TakeoffEngine.calibrateScale(body.pixelLength, body.realLengthMeters, body.unit);
      return createMockResponse({ success: true, scale });
    }

    if (pathname === '/api/plan-budget/compute-polygon') {
      const result = TakeoffEngine.computePolygonArea(body.points, body.scale);
      return createMockResponse({ success: true, ...result });
    }

    if (pathname === '/api/plan-budget/generate-boq') {
      const boq = BoqGenerator.generateDraftBoq(body);
      return createMockResponse({ success: true, boq });
    }

    if (pathname === '/api/plan-budget/procurement') {
      const materials = MaterialProcurementEngine.generateProcurementList(body.boqItems || []);
      return createMockResponse({ success: true, materials });
    }

    if (pathname === '/api/plan-budget/export-excel') {
      const xml = ExcelExportEngine.generateWorkbookXml(body.boq || {}, body.materials || []);
      return createMockResponse(xml, 200, 'application/vnd.ms-excel; charset=utf-8');
    }

    if (pathname === '/api/plan-budget/export-csv') {
      const csv = ExcelExportEngine.generateProcurementCsv(body.materials || []);
      return createMockResponse(csv, 200, 'text/csv; charset=utf-8');
    }

    // 7. Projects & Estimates
    if (pathname === '/api/projects') {
      if (method === 'GET') {
        const projects = getStorage(STORAGE_KEYS.PROJECTS);
        return createMockResponse({ projects });
      }
      if (method === 'POST') {
        const projects = getStorage(STORAGE_KEYS.PROJECTS);
        const newProj = {
          id: 'proj_' + Date.now(),
          name: body.name || 'Untitled Project',
          district: body.district || 'Chennai',
          siteArea: body.siteArea || 0,
          builtupArea: body.builtupArea || 0,
          notes: body.notes || '',
          createdAt: new Date().toISOString()
        };
        projects.unshift(newProj);
        setStorage(STORAGE_KEYS.PROJECTS, projects);
        return createMockResponse(newProj, 201);
      }
    }

    if (pathname === '/api/estimates') {
      if (method === 'POST') {
        const estimates = getStorage(STORAGE_KEYS.ESTIMATES);
        const newEst = {
          id: 'est_' + Date.now(),
          ...body,
          createdAt: new Date().toISOString()
        };
        estimates.unshift(newEst);
        setStorage(STORAGE_KEYS.ESTIMATES, estimates);
        return createMockResponse(newEst, 200);
      }
    }

    if (pathname.startsWith('/api/estimates/project/')) {
      const pId = pathname.replace('/api/estimates/project/', '');
      const estimates = getStorage(STORAGE_KEYS.ESTIMATES).filter(e => e.projectId === pId);
      return createMockResponse({ estimates });
    }

    // 8. Backup & Restore
    if (pathname === '/api/backup') {
      const backup = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        projects: getStorage(STORAGE_KEYS.PROJECTS),
        estimates: getStorage(STORAGE_KEYS.ESTIMATES),
        scrapSettlements: getStorage(STORAGE_KEYS.SCRAP)
      };
      return createMockResponse(backup, 200, 'application/json');
    }

    if (pathname === '/api/restore') {
      if (body.projects) setStorage(STORAGE_KEYS.PROJECTS, body.projects);
      if (body.estimates) setStorage(STORAGE_KEYS.ESTIMATES, body.estimates);
      if (body.scrapSettlements) setStorage(STORAGE_KEYS.SCRAP, body.scrapSettlements);
      return createMockResponse({ success: true, message: 'Data restored successfully' });
    }

    // 404 Local Route
    return createMockResponse({ error: 'Endpoint Not Found', pathname }, 404);
  } catch (err) {
    return createMockResponse({ success: false, error: err.message }, 400);
  }
}

/**
 * Unified API Client
 */
export const apiClient = {
  /**
   * Request dispatcher that attempts server first if connected to a web server,
   * but immediately falls back to client execution if offline or inside Capacitor standalone APK.
   */
  async request(url, options = {}) {
    if (!url.startsWith('/api/')) {
      return fetch(url, options);
    }

    const isCapacitor = typeof window !== 'undefined' && (
      window.Capacitor !== undefined ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443'))
    );
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // Inside standalone Capacitor APK or when offline, run client engine directly
    if (isCapacitor || isOffline) {
      return executeLocalRequest(url, options);
    }

    // When running in standard web browser, try server first with fast fallback
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const opts = { ...options, signal: controller.signal };
      const res = await fetch(url, opts);
      clearTimeout(timer);

      // If server returned 404 (e.g. static CDN or mismatched port), dispatch locally
      if (res.status === 404) {
        return executeLocalRequest(url, options);
      }
      return res;
    } catch (err) {
      // Unreachable server / fetch failed -> Fall back to local execution seamlessly
      return executeLocalRequest(url, options);
    }
  },

  /**
   * Directly execute locally (useful for unit testing or forced offline mode)
   */
  executeLocal: executeLocalRequest
};
