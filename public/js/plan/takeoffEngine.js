/**
 * Plan Takeoff & Geometric Measurement Engine
 * Implements Scale Calibration, Polygon Area Calculation (Shoelace Formula),
 * Linear Measurement, Repetitive Symbol Counting, and Dimension Conflict Detection
 * Inspired by OpenTakeoff architecture with pure ESM portability
 */

import { SafeMath } from '../engine/math.js';

export class TakeoffEngine {
  /**
   * Static scale calibration helper
   */
  static calibrateScale(pixelDistance, realLength, unit = 'm') {
    if (!pixelDistance || pixelDistance <= 0) {
      throw new Error('Pixel distance must be greater than 0');
    }
    if (!realLength || realLength <= 0) {
      throw new Error('Real length must be greater than 0');
    }
    const lengthM = unit === 'ft' ? realLength * 0.3048 : realLength;
    const pixelsPerMeter = SafeMath.round(pixelDistance / lengthM, 2);
    const pixelsPerFoot = SafeMath.round(pixelsPerMeter * 0.3048, 2);

    return {
      pixelDistance,
      knownLength: realLength,
      lengthM,
      pixelsPerMeter,
      pixelsPerFoot,
      unit
    };
  }

  /**
   * Compute polygon area and perimeter using Shoelace formula
   */
  static computePolygonArea(points, scale) {
    if (!Array.isArray(points) || points.length < 3) {
      throw new Error('A polygon requires at least 3 points');
    }
    const pxPerM = (scale && scale.pixelsPerMeter) ? scale.pixelsPerMeter : 100.0;

    let areaPx = 0;
    let perimPx = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      areaPx += points[i].x * points[j].y;
      areaPx -= points[j].x * points[i].y;
      perimPx += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
    }
    areaPx = Math.abs(areaPx) / 2.0;

    const areaM2 = SafeMath.round(areaPx / (pxPerM * pxPerM), 2);
    const areaSqft = SafeMath.round(areaM2 * 10.7639, 1);
    const perimeterM = SafeMath.round(perimPx / pxPerM, 2);
    const perimeterFt = SafeMath.round(perimeterM * 3.28084, 1);

    return {
      areaM2,
      areaSqft,
      perimeterM,
      perimeterFt,
      pointsCount: n
    };
  }

  /**
   * Compute net takeoff area after subtracting cutout deductions
   */
  static computeNetTakeoff(grossAreaM2, deductions = []) {
    let totalDeductionsM2 = 0;
    for (const d of deductions) {
      if (typeof d.areaM2 === 'number') {
        totalDeductionsM2 += d.areaM2;
      } else if (d.length && d.width) {
        totalDeductionsM2 += d.length * d.width;
      }
    }
    totalDeductionsM2 = SafeMath.round(totalDeductionsM2, 2);
    const netAreaM2 = SafeMath.round(Math.max(0, grossAreaM2 - totalDeductionsM2), 2);
    const netAreaSqft = SafeMath.round(netAreaM2 * 10.7639, 1);

    return {
      grossAreaM2,
      totalDeductionsM2,
      netAreaM2,
      netAreaSqft
    };
  }

  /**
   * Verify dimension conflict between written annotation and scaled/measured dimension
   */
  static verifyDimensionConflict(nominalDimension, measuredDimension, tolerancePercent = 5.0) {
    if (!nominalDimension || nominalDimension <= 0) return { isConflict: false, discrepancyPercent: 0 };
    const diff = Math.abs(measuredDimension - nominalDimension);
    const discrepancyPercent = SafeMath.round((diff / nominalDimension) * 100, 2);
    const isConflict = discrepancyPercent > tolerancePercent;

    return {
      isConflict,
      nominalDimension,
      measuredDimension,
      discrepancyPercent,
      tolerancePercent,
      warningMessage: isConflict ? `Dimension discrepancy of ${discrepancyPercent}% exceeds ${tolerancePercent}% tolerance limit` : null
    };
  }

  constructor() {
    this.sheetsCalibration = new Map(); // sheetKey -> { pixelsPerMeter, unit, knownLength }
    this.measurements = [];
  }

  /**
   * Calibrate scale for a specific drawing sheet
   * @param {string} sheetKey - Unique identifier (e.g. "plan1_page1")
   * @param {Object} points - { p1: {x, y}, p2: {x, y} }
   * @param {number} knownLength - Real world distance
   * @param {string} [unit='m'] - 'm' or 'ft'
   */
  calibrateScale(sheetKey, points, knownLength, unit = 'm') {
    if (!points || !points.p1 || !points.p2) {
      throw new Error('Calibration points missing. Point 1 and Point 2 are required.');
    }
    if (!knownLength || knownLength <= 0) {
      throw new Error('Known calibration length must be a positive number.');
    }

    const dx = points.p2.x - points.p1.x;
    const dy = points.p2.y - points.p1.y;
    const pixelDistance = Math.hypot(dx, dy);

    if (pixelDistance < 5) {
      throw new Error('Selected calibration points are too close together. Zoom in and pick distinct grid lines.');
    }

    const lengthM = unit === 'ft' ? knownLength * 0.3048 : knownLength;
    const pixelsPerMeter = pixelDistance / lengthM;
    const pixelsPerFoot = pixelsPerMeter * 0.3048;

    const calibration = {
      sheetKey,
      pixelDistance,
      knownLength,
      unit,
      lengthM,
      pixelsPerMeter: SafeMath.round(pixelsPerMeter, 4),
      pixelsPerFoot: SafeMath.round(pixelsPerFoot, 4),
      timestamp: new Date().toISOString()
    };

    this.sheetsCalibration.set(sheetKey, calibration);
    return calibration;
  }

  /**
   * Get calibration for a sheet
   */
  getCalibration(sheetKey) {
    return this.sheetsCalibration.get(sheetKey) || null;
  }

  /**
   * Add a geometric measurement on a drawing sheet
   * @param {Object} item
   * @param {string} item.sheetKey
   * @param {string} item.type - 'LINEAR', 'POLYGON_AREA', 'COUNT', 'DEDUCTION'
   * @param {string} item.label - E.g. "Living Room Floor", "Wall 1", "Column C1"
   * @param {Array<Object>} [item.points] - Array of {x, y} coordinates
   * @param {number} [item.count=1] - For symbol counts
   * @param {number} [item.writtenDimensionM] - Written annotation for conflict checking
   */
  addMeasurement(item) {
    const cal = this.getCalibration(item.sheetKey);
    const hasScale = !!cal;
    const pxPerM = cal ? cal.pixelsPerMeter : 100; // fallback standard

    let measuredLengthM = 0;
    let measuredAreaM2 = 0;
    let measuredPerimeterM = 0;
    let conflictWarning = null;

    if (item.type === 'LINEAR' && Array.isArray(item.points) && item.points.length >= 2) {
      let totalPx = 0;
      for (let i = 0; i < item.points.length - 1; i++) {
        totalPx += Math.hypot(item.points[i + 1].x - item.points[i].x, item.points[i + 1].y - item.points[i].y);
      }
      measuredLengthM = SafeMath.round(totalPx / pxPerM, 2);

      // Check conflict with written dimension
      if (item.writtenDimensionM && hasScale) {
        const diff = Math.abs(measuredLengthM - item.writtenDimensionM);
        const pct = (diff / item.writtenDimensionM) * 100;
        if (pct > 5.0) {
          conflictWarning = `⚠️ Dimension Conflict: Measured ${measuredLengthM}m differs from written annotation ${item.writtenDimensionM}m by ${SafeMath.round(pct, 1)}%`;
        }
      }
    } else if ((item.type === 'POLYGON_AREA' || item.type === 'DEDUCTION') && Array.isArray(item.points) && item.points.length >= 3) {
      // Shoelace formula for polygon area
      let areaPx = 0;
      let perimPx = 0;
      const pts = item.points;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        areaPx += pts[i].x * pts[j].y;
        areaPx -= pts[j].x * pts[i].y;
        perimPx += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      }
      areaPx = Math.abs(areaPx) / 2;

      measuredAreaM2 = SafeMath.round(areaPx / (pxPerM * pxPerM), 2);
      measuredPerimeterM = SafeMath.round(perimPx / pxPerM, 2);
    } else if (item.type === 'COUNT') {
      // Point symbols
    }

    const measurement = {
      id: `MEAS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sheetKey: item.sheetKey,
      type: item.type,
      label: item.label || 'Takeoff Item',
      points: item.points || [],
      count: item.count || 1,
      measuredLengthM,
      measuredAreaM2,
      measuredPerimeterM,
      areaSqft: SafeMath.round(measuredAreaM2 * 10.7639, 1),
      lengthFt: SafeMath.round(measuredLengthM * 3.28084, 1),
      isScaleVerified: hasScale,
      conflictWarning,
      timestamp: new Date().toISOString()
    };

    this.measurements.push(measurement);
    return measurement;
  }

  /**
   * Get all measurements for a sheet or project
   */
  getMeasurements(sheetKey = null) {
    if (sheetKey) {
      return this.measurements.filter(m => m.sheetKey === sheetKey);
    }
    return this.measurements;
  }
}
