/**
 * DDevUltraHome Production Server
 * Pure Node.js 26 ESM HTTP REST Server & PWA Static Host
 * Zero External Dependencies • 100% Offline-Capable • SQLite Persisted
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppDatabase } from './src/db/database.js';
import { ConcreteEngine } from './src/engine/concrete.js';
import { RccEngine } from './src/engine/rcc.js';
import { MasonryEngine } from './src/engine/masonry.js';
import { FinishingEngine } from './src/engine/finishing.js';
import { EarthworkEngine } from './src/engine/earthwork.js';
import { BbsEngine } from './src/engine/bbs.js';
import { WaterTankEngine } from './src/engine/watertank.js';
import { LabourEngine } from './src/engine/labour.js';
import { BoqEngine } from './src/engine/boq.js';
import { SepticTankEngine } from './src/engine/septictank.js';
import { MilestonesEngine } from './src/engine/milestones.js';
import { MaterialPriceIntelligence, TN_DISTRICTS } from './src/intelligence/materialRates.js';
import { ScrapRatesEngine } from './src/intelligence/scrapRates.js';
import { ScrapValuationEngine } from './src/intelligence/scrapValuation.js';
import { aiService } from './src/ai/provider.js';
import { I18n } from './src/i18n/translations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'ddevultrahome.sqlite');
const db = new AppDatabase(DB_FILE);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // --- API Endpoints ---
  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'UP',
        appName: 'DDevUltraHome',
        version: '1.0.0',
        nodeVersion: process.version,
        region: 'Tamil Nadu, India',
        standards: ['IS 456', 'IS 1200', 'IS 2502', 'TN PWD SOR 2025-26']
      });
    }

    if (pathname === '/api/districts' && req.method === 'GET') {
      return sendJson(res, 200, { districts: TN_DISTRICTS });
    }

    if (pathname === '/api/i18n' && req.method === 'GET') {
      const lang = urlObj.searchParams.get('lang') || 'en';
      return sendJson(res, 200, I18n.get(lang));
    }

    // Material Rates
    if (pathname === '/api/rates' && req.method === 'GET') {
      const district = urlObj.searchParams.get('district') || 'Chennai';
      const rates = MaterialPriceIntelligence.getRatesForDistrict(district);
      return sendJson(res, 200, { district, rates });
    }

    // Scrap Rates
    if (pathname === '/api/scrap/rates' && req.method === 'GET') {
      const rates = ScrapRatesEngine.getAllRates();
      return sendJson(res, 200, { rates });
    }

    if (pathname === '/api/scrap/calculate' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = ScrapValuationEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/scrap/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const id = db.saveScrapSettlement(body);
      return sendJson(res, 200, { success: true, id });
    }

    if (pathname === '/api/scrap/settlements' && req.method === 'GET') {
      const list = db.getAllScrapSettlements();
      return sendJson(res, 200, { settlements: list });
    }

    // Calculations
    if (pathname === '/api/calculate/concrete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = ConcreteEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/rcc' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const type = (body.elementType || 'SLAB').toUpperCase();
      let result;
      if (type === 'SLAB') result = RccEngine.calculateSlab(body);
      else if (type === 'BEAM') result = RccEngine.calculateBeam(body);
      else if (type === 'COLUMN') result = RccEngine.calculateColumn(body);
      else if (type === 'FOOTING') result = RccEngine.calculateFooting(body);
      else if (type === 'STAIRCASE') result = RccEngine.calculateStaircase(body);
      else throw new Error(`Unknown RCC element type: ${type}`);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/masonry' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = MasonryEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/finishing' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const type = (body.finishingType || 'PLASTER').toUpperCase();
      let result;
      if (type === 'PLASTER') result = FinishingEngine.calculatePlaster(body);
      else if (type === 'PAINT') result = FinishingEngine.calculatePainting(body);
      else if (type === 'FLOORING') result = FinishingEngine.calculateFlooring(body);
      else throw new Error(`Unknown finishing type: ${type}`);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/earthwork' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = EarthworkEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/bbs' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let result;
      if (body.type === 'STIRRUP') {
        result = BbsEngine.calculateStirrup(body);
      } else {
        result = BbsEngine.generateSchedule(body.scheduleEntries || []);
      }
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/watertank' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = WaterTankEngine.calculateCapacity(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/labour' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = LabourEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/boq' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = BoqEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/septictank' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = SepticTankEngine.calculate(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/calculate/milestones' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = MilestonesEngine.calculateSchedule(body.totalContractAmount, body.customStages);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/boq/export-csv' && req.method === 'POST') {
      const body = await parseJsonBody(req);
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

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="DDevUltraHome_BOQ_Estimate.csv"'
      });
      return res.end(csv);
    }

    // AI & Civil Knowledge Engine
    if (pathname === '/api/ai/ask' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const response = await aiService.ask(body.prompt || '', body.context || {});
      return sendJson(res, 200, response);
    }

    // Project & Estimate DB Management
    if (pathname === '/api/projects' && req.method === 'GET') {
      return sendJson(res, 200, { projects: db.getAllProjects() });
    }

    if (pathname === '/api/projects' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const proj = db.createProject(body);
      return sendJson(res, 201, proj);
    }

    if (pathname === '/api/estimates' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const est = db.saveEstimate(body);
      return sendJson(res, 200, est);
    }

    if (pathname.startsWith('/api/estimates/project/') && req.method === 'GET') {
      const pId = pathname.replace('/api/estimates/project/', '');
      return sendJson(res, 200, { estimates: db.getEstimatesForProject(pId) });
    }

    if (pathname === '/api/backup' && req.method === 'GET') {
      const backup = db.exportBackupJson();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="DDevUltraHome_Backup_${Date.now()}.json"`
      });
      return res.end(JSON.stringify(backup, null, 2));
    }

    if (pathname === '/api/restore' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      db.importBackupJson(body);
      return sendJson(res, 200, { success: true, message: 'Database successfully restored from backup' });
    }

    // --- Static File Serving (PWA Client) ---
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';

    const filePath = path.join(__dirname, 'public', safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // 404
    sendJson(res, 404, { error: 'Not Found', path: pathname });
  } catch (err) {
    sendJson(res, 400, {
      success: false,
      error: err.message || 'An error occurred processing the request'
    });
  }
});

export { server, db };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` DDevUltraHome Production Server is Running`);
    console.log(` Region: Tamil Nadu, India`);
    console.log(` Local:  http://localhost:${PORT}`);
    console.log(` Network: http://127.0.0.1:${PORT}`);
    console.log(` Database: ${DB_FILE}`);
    console.log(`====================================================`);
  });
}
