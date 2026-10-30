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
