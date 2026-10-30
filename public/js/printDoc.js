/**
 * DDevUltraHome — Print and PDF Engine for Android WebView and Browser
 * 
 * Rules:
 * 1. Never call print inside a hidden iframe (Android WebView blocks iframe.contentWindow.print).
 * 2. Injects printable HTML into #ddev-print-host and uses print stylesheet.
 * 3. Handoff via navigator.share with file when supported, fallback to body-appended download link.
 * 4. Pure minimal valid multi-page PDF generator (PDF-1.4, Helvetica, xref, %%EOF).
 */

/**
 * Print HTML document safely in Android WebView and modern browsers
 * @param {string} html 
 */
export function printHtml(html) {
  let host = document.getElementById('ddev-print-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ddev-print-host';
    document.body.appendChild(host);
  }

  let style = document.getElementById('ddev-print-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ddev-print-style';
    style.textContent = `
      @media screen {
        #ddev-print-host {
          display: none !important;
        }
      }
      @media print {
        body > *:not(#ddev-print-host) {
          display: none !important;
        }
        #ddev-print-host {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          margin: 0;
          padding: 24px;
          background: #ffffff !important;
          color: #000000 !important;
          box-sizing: border-box;
        }
      }
    `;
    document.head.appendChild(style);
  }

  host.innerHTML = html;

  // Let browser render the host DOM node before opening print dialog
  setTimeout(() => {
    window.print();
  }, 120);
}

/**
 * Deliver a file via native Android share sheet or body-appended download link
 * @param {string} filename 
 * @param {Blob|Uint8Array|string} fileBlob 
 */
export async function handoffFile(filename, fileBlob) {
  const blob = fileBlob instanceof Blob 
    ? fileBlob 
    : new Blob([fileBlob], { type: filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream' });

  // 1. Try native Web Share API with file payload
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename
        });
        return { shared: true };
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        return { cancelled: true };
      }
      console.warn('Native navigator.share failed, falling back to download:', e);
    }
  }

  // 2. Fallback: Body-appended anchor link (Required for Android WebView)
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 250);
    return { downloaded: true };
  }

  return { success: false };
}

/**
 * Convert Blob to base64 string for Capacitor Filesystem
 * @param {Blob} blob 
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      if (blob && blob.arrayBuffer) {
        blob.arrayBuffer().then(buf => {
          resolve(Buffer.from(buf).toString('base64'));
        }).catch(reject);
        return;
      }
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const parts = reader.result.split(',');
        resolve(parts[1] || parts[0]);
      } else {
        resolve('');
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Deliver a PDF document:
 * 1. Writes with Capacitor Filesystem in CACHE directory
 * 2. Opens Capacitor Share with files: [uri]
 * 3. Falls back to navigator.share, then body-appended download link
 * Never calls window.print()
 * 
 * @param {string} filename 
 * @param {Blob|string[]|string} pdfInput Blob, array of text lines, or PDF raw string
 * @param {Object} options Optional share parameters (title, text, dialogTitle)
 * @returns {Promise<{ success: boolean, method: string, cancelled?: boolean }>}
 */
export async function deliverPdf(filename, pdfInput, options = {}) {
  let blob;
  if (pdfInput instanceof Blob) {
    blob = pdfInput;
  } else if (Array.isArray(pdfInput)) {
    blob = textToPdf(pdfInput);
  } else if (typeof pdfInput === 'string' && pdfInput.startsWith('%PDF')) {
    const bytes = new Uint8Array(pdfInput.length);
    for (let i = 0; i < pdfInput.length; i++) bytes[i] = pdfInput.charCodeAt(i) & 0xff;
    blob = new Blob([bytes], { type: 'application/pdf' });
  } else {
    blob = textToPdf(pdfInput || '');
  }

  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  // 1. Try Native Capacitor Filesystem (CACHE) & Capacitor Share
  try {
    let Filesystem = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Filesystem : null;
    let Share = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Share : null;

    if (typeof window !== 'undefined' && (!Filesystem || !Share)) {
      try {
        const fsMod = await import('@capacitor/filesystem');
        if (fsMod?.Filesystem) Filesystem = Filesystem || fsMod.Filesystem;
      } catch (_) {}
      try {
        const shareMod = await import('@capacitor/share');
        if (shareMod?.Share) Share = Share || shareMod.Share;
      } catch (_) {}
    }

    if (Filesystem && Share) {
      const base64Data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: 'CACHE',
        recursive: true
      });

      let fileUri = writeResult?.uri;
      if (!fileUri && Filesystem.getUri) {
        const uriRes = await Filesystem.getUri({
          path: safeFilename,
          directory: 'CACHE'
        });
        fileUri = uriRes?.uri;
      }

      if (fileUri) {
        await Share.share({
          title: options.title || safeFilename,
          text: options.text || 'D DEV ULTRA HOMES Quotation Document',
          files: [fileUri],
          dialogTitle: options.dialogTitle || 'Share Quotation PDF'
        });
        return { success: true, method: 'capacitor', uri: fileUri };
      }
    }
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('user cancelled') || msg.includes('dismiss')) {
      return { success: true, cancelled: true, method: 'capacitor' };
    }
    console.warn('Capacitor Filesystem/Share failed, attempting standard fallbacks:', err);
  }

  // 2. Fallback: Web Share API (navigator.share with File)
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], safeFilename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: options.title || safeFilename,
          text: options.text || 'D DEV ULTRA HOMES Quotation'
        });
        return { success: true, method: 'navigator.share' };
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: true, cancelled: true, method: 'navigator.share' };
      }
      console.warn('navigator.share failed, falling back to download:', e);
    }
  }

  // 3. Fallback: Body-appended anchor download link (required for Android WebView)
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 250);
    return { success: true, downloaded: true, method: 'download' };
  }

  return { success: false, method: 'none' };
}

/**
 * Minimal valid multi-page PDF generator (PDF-1.4, Helvetica, xref, %%EOF)
 * @param {string[]|string} lines 
 * @returns {Blob} PDF binary Blob
 */
export function textToPdf(lines) {
  const pageSize = [595.28, 841.89]; // A4 in points
  const linesPerPage = 42;
  const pageChunks = [];
  const allLines = Array.isArray(lines) ? lines : String(lines || '').split('\n');

  if (allLines.length === 0) {
    pageChunks.push(['']);
  } else {
    for (let i = 0; i < allLines.length; i += linesPerPage) {
      pageChunks.push(allLines.slice(i, i + linesPerPage));
    }
  }

  const numPages = pageChunks.length;
  const pageObjIds = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(4 + i * 2);
  }

  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = { 0: 0 };

  function getByteLength(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(str, 'binary');
    }
    return unescape(encodeURIComponent(str)).length;
  }

  function addObj(id, content) {
    offsets[id] = getByteLength(body);
    body += `${id} 0 obj\n${content}\nendobj\n`;
  }

  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${numPages} >>`);
  addObj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  for (let p = 0; p < numPages; p++) {
    const pageId = pageObjIds[p];
    const contentId = pageId + 1;
    addObj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageSize[0]} ${pageSize[1]}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);

    const chunk = pageChunks[p];
    let stream = 'BT\n/F1 10 Tf\n14 TL\n50 790 Td\n';
    for (const line of chunk) {
      const sanitized = String(line || '')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
      stream += `(${sanitized}) '\n`;
    }
    stream += 'ET\n';

    const streamLen = getByteLength(stream);
    addObj(contentId, `<< /Length ${streamLen} >>\nstream\n${stream}endstream`);
  }

  const xrefOffset = getByteLength(body);
  const totalObjs = 3 + numPages * 2;
  body += `xref\n0 ${totalObjs + 1}\n`;
  body += '0000000000 65535 f \r\n';
  for (let i = 1; i <= totalObjs; i++) {
    const off = String(offsets[i] || 0).padStart(10, '0');
    body += `${off} 00000 n \r\n`;
  }
  body += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Convert binary string to Blob
  if (typeof Blob !== 'undefined') {
    const bytes = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) {
      bytes[i] = body.charCodeAt(i) & 0xff;
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }

  return body;
}

const QUOTE_STAGES = [
  ['1', 'Advance on acceptance', 18.92],
  ['2', 'Foundation and plinth', 14.19],
  ['3', 'Ground floor roof slab', 16.56],
  ['4', 'First floor roof slab', 14.19],
  ['5', 'Brickwork and plaster', 16.56],
  ['6', 'Flooring and finishing', 11.83],
  ['7', 'Fixtures and painting', 7.1],
  ['8', 'Handover balance', 0.65]
];

function inrWhole(value) {
  const n = Math.round(Number(value) || 0);
  return `Rs.${n.toLocaleString('en-IN')}`;
}

function stageAmounts(total, stages) {
  const grand = Math.round(Number(total) || 0);
  let used = 0;
  return stages.map((stage, index) => {
    if (index === stages.length - 1) {
      return { ...stage, amount: grand - used };
    }
    const amount = Math.round(grand * (stage.percent / 100));
    used += amount;
    return { ...stage, amount };
  });
}

/**
 * Client-ready quotation PDF. Helvetica, A4, firm watermark on every page.
 * @param {object} quote
 * @returns {Blob|string}
 */
export function buildQuotationPdf(quote) {
  const q = quote || {};
  const items = Array.isArray(q.items) ? q.items : [];
  const company = q.company || {};
  const firm = company.company_name || company.name || 'D DEV ULTRA HOMES';
  const tagline = company.tagline || 'Building your dreams';
  const address = company.address || '6a MGR Nagar, 2nd Cross Street, Velachery, Chennai 600042';
  const phone = company.phone || '+91 98414 24271';
  const client = q.client_name || q.clientName || 'House owner';
  const site = q.project_name || q.site || q.title || 'Site';
  const number = q.quotation_number || q.number || 'QUOTATION';
  const revision = q.revision_number ?? q.revision ?? 0;
  const subtotal = Number(q.subtotal ?? q.total_amount ?? 0);
  const tax = Number(q.tax_amount ?? 0);
  const grand = Math.round(Number(q.total_amount ?? subtotal + tax) || 0);
  const rawStages = Array.isArray(q.milestones) && q.milestones.length
    ? q.milestones.map((m, i) => ({
        code: String(m.milestone_code || m.code || i + 1),
        title: m.title || m.name || 'Stage',
        percent: Number(m.target_percentage ?? m.percent ?? 0)
      }))
    : QUOTE_STAGES.map(([code, title, percent]) => ({ code, title, percent }));
  const stages = stageAmounts(grand, rawStages);

  const pages = [];
  let ops = [];
  let y = 800;

  function newPage() {
    if (ops.length) pages.push(ops);
    ops = [];
    y = 800;
  }

  function need(height) {
    if (y - height < 64) newPage();
  }

  const INK = [0.07, 0.09, 0.12];
  const WHITE = [1, 1, 1];
  const GOLD = [0.894, 0.761, 0.478];
  const COPPER = [0.769, 0.361, 0.071];

  function text(x, yy, size, font, value, rgb = INK) {
    const clean = String(value ?? '').replace(/[^\x20-\x7E]/g, ' ');
    ops.push({
      t: 'text', x, y: yy, size, font, value: clean,
      r: rgb[0], g: rgb[1], b: rgb[2]
    });
  }

  function fill(x, yy, w, h, r, g, b) {
    ops.push({ t: 'fill', x, y: yy, w, h, r, g, b });
  }

  function wrap(value, width, size) {
    const words = String(value ?? '').replace(/[^\x20-\x7E]/g, ' ').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const max = Math.max(8, Math.floor(width / (size * 0.5)));
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  fill(0, 800, 595, 42, 0.043, 0.098, 0.173);
  text(36, 822, 16, 'F2', firm, WHITE);
  text(36, 806, 9, 'F1', tagline, GOLD);
  text(400, 818, 9, 'F1', `No. ${number}`, WHITE);
  text(400, 806, 9, 'F1', `Rev ${revision}`, GOLD);
  y = 786;
  text(36, y, 8, 'F1', `${address}  |  ${phone}`);
  y -= 22;
  text(36, y, 13, 'F2', 'OFFICIAL QUOTATION');
  y -= 18;
  need(52);
  fill(36, y - 40, 250, 48, 0.96, 0.95, 0.93);
  fill(306, y - 40, 252, 48, 0.96, 0.95, 0.93);
  text(44, y - 8, 8, 'F2', 'HOUSE OWNER');
  text(44, y - 22, 11, 'F2', client);
  text(314, y - 8, 8, 'F2', 'SITE');
  const siteLines = wrap(site, 230, 10);
  siteLines.slice(0, 2).forEach((line, i) => text(314, y - 22 - i * 12, 10, 'F1', line));
  y -= 62;

  need(28);
  fill(36, y - 6, 523, 18, 0.043, 0.098, 0.173);
  text(42, y, 8, 'F2', '#', WHITE);
  text(64, y, 8, 'F2', 'DESCRIPTION', WHITE);
  text(330, y, 8, 'F2', 'QTY', WHITE);
  text(390, y, 8, 'F2', 'RATE', WHITE);
  text(480, y, 8, 'F2', 'AMOUNT', WHITE);
  y -= 20;

  const rows = items.length ? items : [{ description: 'Scope as per drawings', quantity: 1, unit: 'job', unit_rate: grand, total_price: grand }];
  rows.forEach((item, index) => {
    const desc = item.description || 'Work';
    const qty = item.quantity ?? 1;
    const unit = item.unit || '';
    const rate = Number(item.unit_rate ?? item.unitRate ?? 0);
    const amount = Number(item.total_price ?? item.totalPrice ?? qty * rate);
    const lines = wrap(desc, 250, 9);
    need(14 * lines.length + 6);
    if (index % 2 === 0) fill(36, y - 4 - (lines.length - 1) * 11, 523, 14 + (lines.length - 1) * 11, 0.97, 0.97, 0.96);
    text(42, y, 9, 'F1', String(index + 1));
    lines.forEach((line, i) => text(64, y - i * 11, 9, 'F1', line));
    text(330, y, 9, 'F1', `${qty} ${unit}`.trim());
    text(390, y, 9, 'F1', inrWhole(rate));
    text(470, y, 9, 'F2', inrWhole(amount));
    y -= 14 + (lines.length - 1) * 11;
  });

  y -= 8;
  need(48);
  text(330, y, 10, 'F1', 'Subtotal');
  text(470, y, 10, 'F1', inrWhole(subtotal || grand));
  y -= 14;
  if (tax > 0) {
    text(330, y, 10, 'F1', 'GST');
    text(470, y, 10, 'F1', inrWhole(tax));
    y -= 14;
  }
  text(330, y, 12, 'F2', 'Grand total', INK);
  text(450, y, 12, 'F2', inrWhole(grand), COPPER);
  y -= 28;

  need(20);
  text(36, y, 11, 'F2', 'SCHEDULE B  —  PAYMENT STAGES');
  y -= 16;
  stages.forEach((stage) => {
    need(14);
    text(36, y, 9, 'F1', `${stage.code}. ${stage.title}`);
    text(470, y, 9, 'F2', inrWhole(stage.amount));
    y -= 13;
  });

  y -= 10;
  need(70);
  text(36, y, 8, 'F1', 'GST is extra unless a rate is shown. Electricity and water are the owner\'s cost.');
  y -= 12;
  text(36, y, 8, 'F1', 'This quotation becomes the construction agreement only after the owner accepts it.');
  y -= 36;
  text(36, y, 9, 'F2', 'BUILDER');
  text(340, y, 9, 'F2', 'HOUSE OWNER');
  y -= 14;
  text(36, y, 9, 'F1', 'C. Selvakumar');
  text(340, y, 9, 'F1', client);
  text(36, y - 12, 8, 'F1', firm);

  pages.push(ops);

  return renderQuotePages(pages);
}

function renderQuotePages(pages) {
  const pageW = 595.28;
  const pageH = 841.89;
  const numPages = pages.length || 1;
  const pageObjIds = [];
  for (let i = 0; i < numPages; i++) pageObjIds.push(6 + i * 2);

  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = {};

  function byteLength(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
    return unescape(encodeURIComponent(str)).length;
  }
  function addObj(id, content) {
    offsets[id] = byteLength(body);
    body += `${id} 0 obj\n${content}\nendobj\n`;
  }
  function esc(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>`);
  addObj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  addObj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  addObj(5, '<< /Type /ExtGState /ca 0.11 /CA 0.11 >>');

  pages.forEach((commands, index) => {
    const pageId = pageObjIds[index];
    const contentId = pageId + 1;
    addObj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ExtGState << /GS1 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    let stream = '';
    for (const op of commands) {
      if (op.t === 'fill') {
        stream += `${op.r} ${op.g} ${op.b} rg\n${op.x} ${op.y} ${op.w} ${op.h} re f\n`;
      } else if (op.t === 'text') {
        stream += `${op.r} ${op.g} ${op.b} rg\nBT /${op.font} ${op.size} Tf 1 0 0 1 ${op.x} ${op.y} Tm (${esc(op.value)}) Tj ET\n`;
      }
    }
    stream += 'q\n/GS1 gs\n0.82 -0.57 0.57 0.82 70 300 cm\n0 0 0 rg\nBT /F2 28 Tf (D DEV ULTRA HOMES) Tj 0 -16 Td /F1 11 Tf (Building your dreams) Tj ET\nQ\n';
    addObj(contentId, `<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`);
  });

  const xrefOffset = byteLength(body);
  const totalObjs = 5 + numPages * 2;
  body += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= totalObjs; i++) {
    body += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \r\n`;
  }
  body += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  if (typeof Blob !== 'undefined') {
    const bytes = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
  return body;
}
