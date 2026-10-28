/**
 * PDF Architectural & Structural Document Extraction Engine
 * In-process pure Node.js ESM PDF Parser & Civil Pattern Extractor
 * Compliant with IS 1200 (Measurement of Building Works) & SP 27 (Handbook on Method of Measurement)
 */

// Browser & Node dual-compatible PDF text extractor
let nodeZlib = null;
try {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    nodeZlib = await import('node:zlib');
  }
} catch (e) {}
import { SafeMath } from '../engine/math.js';

export const DRAWING_TYPES = {
  FLOOR_PLAN: { code: 'FLOOR_PLAN', labelEn: 'Floor Plan', labelTa: 'தள வரைபடம்' },
  STRUCTURAL_FOUNDATION: { code: 'STRUCTURAL_FOUNDATION', labelEn: 'Foundation / Footing Layout', labelTa: 'அடித்தள வரைபடம்' },
  STRUCTURAL_COLUMN_SCHEDULE: { code: 'STRUCTURAL_COLUMN_SCHEDULE', labelEn: 'Column Schedule & Details', labelTa: 'தூண் விவர அட்டவணை' },
  STRUCTURAL_BEAM_SCHEDULE: { code: 'STRUCTURAL_BEAM_SCHEDULE', labelEn: 'Beam Schedule & Details', labelTa: 'பீம் விவர அட்டவணை' },
  STRUCTURAL_SLAB_SCHEDULE: { code: 'STRUCTURAL_SLAB_SCHEDULE', labelEn: 'Slab Schedule & Reinforcement', labelTa: 'தரை/கூரை ஸ்லாப் அட்டவணை' },
  ELEVATION_SECTION: { code: 'ELEVATION_SECTION', labelEn: 'Elevation & Cross Section', labelTa: 'முகப்பு & குறுக்குவெட்டு' },
  SITE_PLAN: { code: 'SITE_PLAN', labelEn: 'Site / Key Plan', labelTa: 'மனை வரைபடம்' },
  SPECIFICATIONS_SCHEDULE: { code: 'SPECIFICATIONS_SCHEDULE', labelEn: 'Joinery / Material Schedule', labelTa: 'மரவேலை & பொருட்கள் அட்டவணை' },
  GENERAL_DRAWING: { code: 'GENERAL_DRAWING', labelEn: 'General Architectural Sheet', labelTa: 'பொது வரைபடம்' }
};

export class PdfExtractor {
  /**
   * Unified plan extraction entry point handling PDF buffers and plain text buffers
   */
  static extractPlan(buffer, options = {}) {
    const fileName = options.fileName || 'document.pdf';
    const isPdf = buffer && buffer.length >= 5 && buffer.subarray(0, 1024).toString('binary').includes('%PDF-');

    if (!isPdf) {
      const rawText = buffer ? buffer.toString('utf-8') : '';
      const drawingType = this._classifyDrawingType(rawText, 1);
      const dimensions = this._extractDimensions(rawText, 1, fileName);
      const schedules = this._extractSchedules(rawText, 1, fileName);
      const roomTakeoffs = this._extractRoomTakeoffs(rawText, 1, fileName);
      return {
        fileName,
        totalPages: 1,
        hasSelectableText: rawText.length > 0,
        extractionMethod: 'PLAIN_TEXT_OPERATOR_PARSER',
        rawTextCount: rawText.length,
        classification: `${drawingType.labelEn} / ${drawingType.labelTa}`,
        classificationConfidence: 'High',
        sheets: [{
          pageNumber: 1,
          sheetTitle: this._extractSheetTitle(rawText, 1),
          drawingType: drawingType.code,
          drawingTypeLabel: drawingType.labelEn,
          drawingTypeLabelTa: drawingType.labelTa,
          dimensions,
          schedules,
          roomTakeoffs
        }],
        dimensions: dimensions.length > 0 ? dimensions : roomTakeoffs,
        schedules,
        rooms: roomTakeoffs
      };
    }

    const res = this.extractFromBuffer(buffer, options);
    const firstSheet = res.sheets[0] || {};
    const classification = firstSheet.drawingTypeLabel ? `${firstSheet.drawingTypeLabel} / ${firstSheet.drawingTypeLabelTa}` : 'Floor Plan / தள வரைபடம்';
    return {
      fileName: res.fileName,
      totalPages: res.totalPages,
      hasSelectableText: res.hasSelectableText,
      extractionMethod: res.extractionMethod,
      rawTextCount: res.sheets.reduce((acc, s) => acc + (s.rawTextLength || 0), 0),
      classification,
      classificationConfidence: res.hasSelectableText ? 'High' : 'Medium',
      sheets: res.sheets,
      dimensions: res.sheets.flatMap(s => s.dimensions),
      schedules: res.sheets.flatMap(s => s.schedules),
      rooms: res.sheets.flatMap(s => s.roomTakeoffs)
    };
  }

  /**
   * Parse PDF buffer, extract native text streams, detect document types, and extract dimensions/schedules
   * @param {Buffer} pdfBuffer - Raw PDF file buffer
   * @param {Object} [options]
   * @param {string} [options.fileName='document.pdf']
   * @param {number} [options.maxPages=25]
   */
  static extractFromBuffer(pdfBuffer, options = {}) {
    const fileName = options.fileName || 'document.pdf';
    const maxPages = options.maxPages || 25;

    // 1. Validate PDF signature (per ISO 32000-1 §7.5.2 header can be within first 1024 bytes)
    if (!pdfBuffer || pdfBuffer.length < 10) {
      throw new Error('Invalid file: File is empty or too small to be a PDF.');
    }

    const header = pdfBuffer.subarray(0, 1024).toString('binary');
    if (!header.includes('%PDF-')) {
      throw new Error('Invalid PDF format: File header does not contain %PDF-');
    }

    // 2. Extract streams from PDF
    const pages = this._extractPagesAndStreams(pdfBuffer, maxPages);
    const hasSelectableText = pages.some(p => p.extractedText && p.extractedText.trim().length > 15);

    // 3. Process each page sheet
    const sheets = pages.map((page, idx) => {
      const pageNum = idx + 1;
      const rawText = page.extractedText || '';
      const drawingType = this._classifyDrawingType(rawText, pageNum);
      const scaleInfo = this._extractScale(rawText);
      const dimensions = this._extractDimensions(rawText, pageNum, fileName);
      const schedules = this._extractSchedules(rawText, pageNum, fileName);
      const roomTakeoffs = this._extractRoomTakeoffs(rawText, pageNum, fileName);

      return {
        pageNumber: pageNum,
        sheetTitle: this._extractSheetTitle(rawText, pageNum),
        drawingType: drawingType.code,
        drawingTypeLabel: drawingType.labelEn,
        drawingTypeLabelTa: drawingType.labelTa,
        isScannedOnly: !hasSelectableText,
        scaleAnnotation: scaleInfo.annotation,
        suggestedScaleFactor: scaleInfo.ratio,
        rawTextLength: rawText.length,
        dimensionsCount: dimensions.length,
        dimensions,
        schedules,
        roomTakeoffs
      };
    });

    // 4. Summarize Project Metadata
    const allDimensions = sheets.flatMap(s => s.dimensions);
    const allSchedules = sheets.flatMap(s => s.schedules);
    const allRooms = sheets.flatMap(s => s.roomTakeoffs);

    return {
      fileName,
      totalPages: sheets.length,
      hasSelectableText,
      extractionMethod: hasSelectableText ? 'NATIVE_PDF_STREAM_PARSER' : 'SCANNED_IMAGE_DETECTION',
      sheets,
      aggregatedData: {
        totalDimensionsFound: allDimensions.length,
        totalRoomsFound: allRooms.length,
        schedulesFound: allSchedules.length,
        rooms: allRooms,
        schedules: allSchedules
      }
    };
  }

  /**
   * Extract text streams from PDF objects
   * @private
   */
  static _extractPagesAndStreams(pdfBuffer, maxPages) {
    const content = pdfBuffer.toString('binary');
    const streamRegex = /\bstream[\r\n]+([\s\S]*?)[\r\n]+\s*endstream/g;
    let match;
    const extractedStreams = [];

    while ((match = streamRegex.exec(content)) !== null) {
      const streamData = Buffer.from(match[1], 'binary');
      let text = '';

      // Try decompressing with FlateDecode (zlib inflate)
      try {
        const decompressed = (nodeZlib?.inflateSync || nodeZlib?.default?.inflateSync)(streamData);
        text = this._parsePdfTextOperators(decompressed.toString('binary'));
      } catch {
        try {
          const rawDecomp = (nodeZlib?.inflateRawSync || nodeZlib?.default?.inflateRawSync)(streamData);
          text = this._parsePdfTextOperators(rawDecomp.toString('binary'));
        } catch {
          // If uncompressed plain text stream
          text = this._parsePdfTextOperators(match[1]);
        }
      }

      if (text && text.trim().length > 0) {
        extractedStreams.push(text);
      }
    }

    // Split or group into pages
    // Standard PDF page breaks often correspond to Page objects
    if (extractedStreams.length === 0) {
      return [{ pageNumber: 1, extractedText: '' }];
    }

    return extractedStreams.slice(0, maxPages).map((text, i) => ({
      pageNumber: i + 1,
      extractedText: text
    }));
  }

  /**
   * Parse PDF text stream operators (BT ... ET, Tj, TJ)
   * @private
   */
  static _parsePdfTextOperators(streamContent) {
    const lines = [];
    const btRegex = /\bBT\b([\s\S]*?)\bET\b/g;
    let btMatch;

    while ((btMatch = btRegex.exec(streamContent)) !== null) {
      const block = btMatch[1];
      
      // Matches (string) Tj or [(string)...] TJ
      const tjRegex = /(?:\(([\s\S]*?)\)\s*Tj)|(?:\[([\s\S]*?)\]\s*TJ)/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        if (tjMatch[1] !== undefined) {
          lines.push(this._unescapePdfString(tjMatch[1]));
        } else if (tjMatch[2] !== undefined) {
          // Inside array: e.g. [(D) 10 (Dev) -20 (Ultra)]
          const innerStrRegex = /\(([\s\S]*?)\)/g;
          let innerMatch;
          const words = [];
          while ((innerMatch = innerStrRegex.exec(tjMatch[2])) !== null) {
            const word = this._unescapePdfString(innerMatch[1]);
            if (word.trim()) words.push(word);
          }
          if (words.length > 0) lines.push(words.join(' '));
        }
      }
    }

    return lines.join(' ');
  }

  /**
   * Unescape standard PDF octal and backslash escapes
   * @private
   */
  static _unescapePdfString(str) {
    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Classify Drawing Type from sheet text
   * @private
   */
  static _classifyDrawingType(text, pageNum) {
    const t = text.toUpperCase();

    if (t.includes('FLOOR PLAN') || t.includes('GROUND FLOOR PLAN') || t.includes('FIRST FLOOR PLAN')) {
      return DRAWING_TYPES.FLOOR_PLAN;
    }
    if (t.includes('FOUNDATION') || t.includes('FOOTING') || t.includes('TRENCH') || t.includes('EXCAVATION') || t.includes('PILE LAYOUT')) {
      return DRAWING_TYPES.STRUCTURAL_FOUNDATION;
    }
    if (t.includes('COLUMN SCHEDULE') || t.includes('COLUMN DETAILS') || (t.includes('COLUMN') && t.includes('REBAR') && t.includes('TIES'))) {
      return DRAWING_TYPES.STRUCTURAL_COLUMN_SCHEDULE;
    }
    if (t.includes('BEAM SCHEDULE') || t.includes('PLINTH BEAM') || t.includes('ROOF BEAM') || (t.includes('BEAM') && t.includes('STIRRUPS'))) {
      return DRAWING_TYPES.STRUCTURAL_BEAM_SCHEDULE;
    }
    if (t.includes('SLAB REINFORCEMENT') || t.includes('SLAB SCHEDULE') || t.includes('WAIST SLAB')) {
      return DRAWING_TYPES.STRUCTURAL_SLAB_SCHEDULE;
    }
    if (t.includes('ELEVATION') || t.includes('SECTION A-A') || t.includes('SECTION B-B') || t.includes('CROSS SECTION')) {
      return DRAWING_TYPES.ELEVATION_SECTION;
    }
    if (t.includes('SITE PLAN') || t.includes('KEY PLAN') || t.includes('LAYOUT PLAN') || t.includes('PLOT BOUNDARY')) {
      return DRAWING_TYPES.SITE_PLAN;
    }
    if (t.includes('SCHEDULE OF JOINERY') || t.includes('DOOR WINDOW') || t.includes('SPECIFICATIONS')) {
      return DRAWING_TYPES.SPECIFICATIONS_SCHEDULE;
    }
    if (t.includes('LIVING') || t.includes('BEDROOM') || t.includes('KITCHEN')) {
      return DRAWING_TYPES.FLOOR_PLAN;
    }

    return DRAWING_TYPES.GENERAL_DRAWING;
  }

  /**
   * Extract Scale information from drawing text
   * @private
   */
  static _extractScale(text) {
    // 1:100, 1:50, 1:200, 1:20
    const metricScaleMatch = text.match(/SCALE\s*[:=\-]?\s*1\s*[:/]\s*(\d{2,3})/i);
    if (metricScaleMatch) {
      const denom = parseInt(metricScaleMatch[1], 10);
      return {
        annotation: `1:${denom}`,
        ratio: 1 / denom,
        type: 'METRIC'
      };
    }

    // Imperial: 1"=8'-0" or 1/4"=1'-0"
    const impScaleMatch = text.match(/SCALE\s*[:=\-]?\s*(?:1\/[248]")?\s*=\s*(\d+)['\-]/i);
    if (impScaleMatch) {
      return {
        annotation: impScaleMatch[0],
        ratio: 1 / (parseInt(impScaleMatch[1], 10) * 12),
        type: 'IMPERIAL'
      };
    }

    return {
      annotation: 'Not Specified / Calibrate Manually',
      ratio: null,
      type: 'UNKNOWN'
    };
  }

  /**
   * Extract Sheet Title
   * @private
   */
  static _extractSheetTitle(text, pageNum) {
    const titleMatch = text.match(/(?:DRAWING TITLE|TITLE|SHEET TITLE)\s*[:=\-]?\s*([A-Za-z0-9\s,\-\/]{4,50})/i);
    if (titleMatch) return titleMatch[1].trim();

    const planMatch = text.match(/(?:GROUND|FIRST|SECOND|TYPICAL|TERRACE)\s+FLOOR\s+PLAN/i);
    if (planMatch) return planMatch[0].toUpperCase();

    return `Sheet ${pageNum}`;
  }

  /**
   * Extract dimension annotations from text
   * @private
   */
  static _extractDimensions(text, pageNum, fileName) {
    const results = [];

    // Pattern 1: Imperial Room Dimensions (e.g. 12'-0" x 11'-6" or 16' x 14')
    const impDimRegex = /([A-Za-z0-9\s]+?)\s*[:=\-]?\s*(\d{1,2})['′\-]\s*(\d{1,2})?["″]?\s*[xX×*]\s*(\d{1,2})['′\-]\s*(\d{1,2})?["″]?/g;
    let m;
    while ((m = impDimRegex.exec(text)) !== null) {
      const label = m[1].trim();
      const lFeet = parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 12 : 0);
      const wFeet = parseInt(m[4], 10) + (m[5] ? parseInt(m[5], 10) / 12 : 0);
      const lM = SafeMath.round(lFeet * 0.3048, 2);
      const wM = SafeMath.round(wFeet * 0.3048, 2);
      const areaSqft = SafeMath.round(lFeet * wFeet, 2);
      const areaM2 = SafeMath.round(lM * wM, 2);

      results.push({
        id: `DIM-${pageNum}-${results.length + 1}`,
        rawText: m[0],
        label: label || 'Room Dimension',
        lengthM: lM,
        widthM: wM,
        lengthFt: lFeet,
        widthFt: wFeet,
        areaM2,
        areaSqft,
        unit: 'm / ft',
        sourceFile: fileName,
        pageNumber: pageNum,
        extractionMethod: 'NATIVE_PDF_TEXT',
        confidenceScore: 0.95,
        reviewStatus: 'Pending'
      });
    }

    // Pattern 2: Metric Room Dimensions (e.g. 3600 x 3000 mm or 3.6m x 3.0m)
    const metricDimRegex = /([A-Za-z0-9\s]+?)\s*[:=\-]?\s*(\d{4})\s*[xX×*]\s*(\d{4})\s*(?:MM)?/gi;
    let mm;
    while ((mm = metricDimRegex.exec(text)) !== null) {
      const label = mm[1].trim();
      const lMm = parseInt(mm[2], 10);
      const wMm = parseInt(mm[3], 10);
      const lM = SafeMath.round(lMm / 1000, 2);
      const wM = SafeMath.round(wMm / 1000, 2);
      const areaM2 = SafeMath.round(lM * wM, 2);
      const areaSqft = SafeMath.round(areaM2 * 10.7639, 2);

      results.push({
        id: `DIM-${pageNum}-${results.length + 1}`,
        rawText: mm[0],
        label: label || 'Metric Room Dimension',
        lengthM: lM,
        widthM: wM,
        lengthFt: SafeMath.round(lM * 3.28084, 2),
        widthFt: SafeMath.round(wM * 3.28084, 2),
        areaM2,
        areaSqft,
        unit: 'm / mm',
        sourceFile: fileName,
        pageNumber: pageNum,
        extractionMethod: 'NATIVE_PDF_TEXT',
        confidenceScore: 0.96,
        reviewStatus: 'Pending'
      });
    }

    // Pattern 3: Metric Decimal Meters (e.g. 4.88 x 3.66 M or 4.88 x 3.66)
    const meterDimRegex = /([A-Za-z0-9\s]+?)\s*[:=\-]?\s*\b(\d{1,2}(?:\.\d{1,3})?)\b\s*[xX×*]\s*\b(\d{1,2}(?:\.\d{1,3})?)\b\s*(?:M|METERS?)?/gi;
    let md;
    while ((md = meterDimRegex.exec(text)) !== null) {
      const lM = parseFloat(md[2]);
      const wM = parseFloat(md[3]);
      if (lM >= 0.8 && lM <= 50.0 && wM >= 0.8 && wM <= 50.0) {
        const label = md[1].trim();
        const areaM2 = SafeMath.round(lM * wM, 2);
        const areaSqft = SafeMath.round(areaM2 * 10.7639, 1);
        results.push({
          id: `DIM-${pageNum}-${results.length + 1}`,
          rawText: md[0],
          label: label || 'Metric Room Dimension',
          length: lM,
          width: wM,
          lengthM: lM,
          widthM: wM,
          lengthFt: SafeMath.round(lM * 3.28084, 1),
          widthFt: SafeMath.round(wM * 3.28084, 1),
          areaM2,
          areaSqft,
          unit: 'm',
          sourceFile: fileName,
          pageNumber: pageNum,
          extractionMethod: 'NATIVE_PDF_TEXT',
          confidenceScore: 0.95,
          reviewStatus: 'Pending'
        });
      }
    }

    return results;
  }

  /**
   * Extract Structural Schedules (Columns, Beams, Footings, Slabs, Joinery)
   * @private
   */
  static _extractSchedules(text, pageNum, fileName) {
    const schedules = [];

    // Column Schedule Pattern: C1, C2 (e.g. C1 300x300 4-16# + 4-12#)
    const colRegex = /\b(C\d{1,2})\b\s*[:=\-]?\s*(\d{2,4})\s*[xX×*]\s*(\d{2,4})\s*(?:MM)?(?:\s*([A-Za-z0-9\s\-#+]+))?/gi;
    let cm;
    while ((cm = colRegex.exec(text)) !== null) {
      schedules.push({
        category: 'COLUMN',
        memberType: 'Column',
        code: cm[1].toUpperCase(),
        dimensionsMm: `${cm[2]} x ${cm[3]} mm`,
        widthM: parseInt(cm[2], 10) / 1000,
        depthM: parseInt(cm[3], 10) / 1000,
        reinforcementDetail: cm[4] ? cm[4].trim() : 'Fe550D TMT',
        sourceFile: fileName,
        pageNumber: pageNum,
        reviewStatus: 'Pending'
      });
    }

    // Footing Schedule Pattern: F1, F2 (handles both mm: 1500x1500x450 and meters: 1.5x1.5x0.45m)
    const footRegex = /\b(F\d{1,2})\b\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)(?:\s*[xX×*]\s*(\d+(?:\.\d+)?))?\s*(?:M|MM)?/gi;
    let fm;
    while ((fm = footRegex.exec(text)) !== null) {
      let rawL = parseFloat(fm[2]);
      let rawW = parseFloat(fm[3]);
      let rawD = fm[4] ? parseFloat(fm[4]) : 0.45;
      const lengthM = rawL > 50 ? SafeMath.round(rawL / 1000, 2) : rawL;
      const widthM = rawW > 50 ? SafeMath.round(rawW / 1000, 2) : rawW;
      const depthMm = rawD <= 5 ? Math.round(rawD * 1000) : Math.round(rawD);

      schedules.push({
        category: 'FOOTING',
        memberType: 'Footing',
        code: fm[1].toUpperCase(),
        lengthM,
        widthM,
        depthMm,
        sourceFile: fileName,
        pageNumber: pageNum,
        reviewStatus: 'Pending'
      });
    }

    // Beam Schedule Pattern: B1, PB1, RB1
    const beamRegex = /\b(PB\d{1,2}|RB\d{1,2}|B\d{1,2})\b\s*[:=\-]?\s*(\d{3})\s*[xX×*]\s*(\d{3,4})/gi;
    let bm;
    while ((bm = beamRegex.exec(text)) !== null) {
      schedules.push({
        category: 'BEAM',
        memberType: 'Beam',
        code: bm[1].toUpperCase(),
        widthM: parseInt(bm[2], 10) / 1000,
        depthM: parseInt(bm[3], 10) / 1000,
        sourceFile: fileName,
        pageNumber: pageNum,
        reviewStatus: 'Pending'
      });
    }

    // Joinery Schedule: D1 (1000x2100), D2 (900x2100), W1 (1200x1500), V1 (600x600)
    const joinRegex = /\b(MD|D\d|W\d|V\d)\b\s*[:=\-]?\s*(\d{3,4})\s*[xX×*]\s*(\d{3,4})/gi;
    let jm;
    while ((jm = joinRegex.exec(text)) !== null) {
      const wM = parseInt(jm[2], 10) / 1000;
      const hM = parseInt(jm[3], 10) / 1000;
      schedules.push({
        category: 'JOINERY',
        code: jm[1].toUpperCase(),
        type: jm[1].startsWith('D') || jm[1] === 'MD' ? 'DOOR' : (jm[1].startsWith('W') ? 'WINDOW' : 'VENTILATOR'),
        widthM: wM,
        heightM: hM,
        areaM2: SafeMath.round(wM * hM, 2),
        sourceFile: fileName,
        pageNumber: pageNum,
        reviewStatus: 'Pending'
      });
    }

    return schedules;
  }

  /**
   * Extract standardized room takeoff summary
   * @private
   */
  static _extractRoomTakeoffs(text, pageNum, fileName) {
    const rooms = [];
    const roomKeywords = [
      'LIVING', 'HALL', 'DINING', 'BEDROOM', 'MASTER BEDROOM', 'GUEST BEDROOM',
      'KITCHEN', 'POOJA', 'BATH', 'TOILET', 'UTILITY', 'BALCONY', 'PORTICO', 'VERANDAH'
    ];

    for (const kw of roomKeywords) {
      const regex = new RegExp(`\\b${kw}\\b[\\s\\S]{0,30}?(\\d{1,2})['′\\-]\\s*(\\d{1,2})?["″]?\\s*[xX×*]\\s*(\\d{1,2})['′\\-]\\s*(\\d{1,2})?["″]?`, 'i');
      const match = text.match(regex);
      if (match) {
        const lFeet = parseInt(match[1], 10) + (match[2] ? parseInt(match[2], 10) / 12 : 0);
        const wFeet = parseInt(match[3], 10) + (match[4] ? parseInt(match[4], 10) / 12 : 0);
        const lM = SafeMath.round(lFeet * 0.3048, 2);
        const wM = SafeMath.round(wFeet * 0.3048, 2);
        const areaSqft = SafeMath.round(lFeet * wFeet, 1);
        const areaM2 = SafeMath.round(lM * wM, 2);
        const perimeterM = SafeMath.round(2 * (lM + wM), 2);

        rooms.push({
          name: kw,
          lengthM: lM,
          widthM: wM,
          lengthFt: lFeet,
          widthFt: wFeet,
          areaM2,
          areaSqft,
          perimeterM,
          ceilingHeightM: 3.0, // standard 10ft / 3.0m ceiling
          pageNumber: pageNum,
          sourceFile: fileName
        });
      }
    }

    return rooms;
  }
}
