/**
 * Bar Bending Schedule (BBS) & Reinforcement Steel Engine
 * Compliant with IS 2502:1963, IS 456:2000, and SP 34
 */

import { SafeMath, Validator } from './math.js';

export const REBAR_DIAMETERS = [6, 8, 10, 12, 16, 20, 25, 28, 32];

export class BbsEngine {
  /**
   * Unit weight of steel rebar per meter: d² / 162.28 kg/m
   * Derived from steel density 7850 kg/m³: (π / 4) * (d / 1000)² * 7850 = d² / 162.28
   */
  static getUnitWeight(diameterMm) {
    const d = Number(diameterMm);
    if (!d || d <= 0) return 0;
    return SafeMath.round((d * d) / 162.28, 4);
  }

  /**
   * Bend deductions in rebar elongation per IS 2502
   * 45° bend = 1d
   * 90° bend = 2d
   * 135° bend = 3d
   * 180° hook = 4d
   */
  static getBendDeduction(diameterMm, angleDegrees) {
    const d = Number(diameterMm);
    const ang = Number(angleDegrees);
    if (ang === 45) return SafeMath.round(1 * d, 1);
    if (ang === 90) return SafeMath.round(2 * d, 1);
    if (ang === 135) return SafeMath.round(3 * d, 1);
    if (ang === 180) return SafeMath.round(4 * d, 1);
    // Generic proportional deduction
    return SafeMath.round((ang / 45) * d, 1);
  }

  /**
   * Calculate Rectangular Stirrup / Tie Cutting Length
   * @param {Object} params
   * @param {number} params.memberWidthMm - Beam/column gross width
   * @param {number} params.memberDepthMm - Beam/column gross depth
   * @param {number} params.barDiameterMm - Stirrup dia (typically 8mm)
   * @param {number} [params.clearCoverMm=25] - Clear cover (25mm beam, 40mm column)
   * @param {number} [params.hookAngle=135] - Hook angle (135° standard seismic hook per IS 13920)
   */
  static calculateStirrup(params) {
    const steps = [];
    const assumptions = [];

    const wMm = Number(params.memberWidthMm !== undefined ? params.memberWidthMm : params.beamWidthMm) || 0;
    const dMm = Number(params.memberDepthMm !== undefined ? params.memberDepthMm : params.beamDepthMm) || 0;
    const barDia = Number(params.barDiameterMm !== undefined ? params.barDiameterMm : params.stirrupBarDiaMm) || 8;
    const cover = Number(params.clearCoverMm !== undefined ? params.clearCoverMm : params.coverMm) || 25;
    const hookAngle = Number(params.hookAngle !== undefined ? params.hookAngle : params.hookAngleDeg) || 135;

    if (wMm <= 0 || dMm <= 0 || barDia <= 0) {
      throw new Error('Valid member dimensions and rebar diameter are required for stirrup calculation.');
    }

    // Core dimensions
    const a = wMm - 2 * cover;
    const b = dMm - 2 * cover;
    if (a <= 0 || b <= 0) {
      throw new Error('Clear cover exceeds member dimensions.');
    }
    steps.push(`Stirrup internal core dimensions: A = ${wMm} - 2(${cover}) = ${a}mm, B = ${dMm} - 2(${cover}) = ${b}mm`);

    // Standard seismic hook length = 10d or minimum 75mm
    const hookLength = Math.max(10 * barDia, 75);
    const totalHookLength = 2 * hookLength;
    steps.push(`Seismic hooks (2 nos @ ${hookAngle}°): 2 × max(10d, 75mm) = 2 × ${hookLength}mm = ${totalHookLength}mm`);

    // Bend deductions: 3 nos of 90° bends + 2 nos of 135° hooks
    const bend90Deduction = 3 * this.getBendDeduction(barDia, 90); // 3 * 2d = 6d
    const bendHookDeduction = 2 * this.getBendDeduction(barDia, hookAngle); // 2 * 3d = 6d for 135°
    const totalBendDeductions = bend90Deduction + bendHookDeduction;
    steps.push(`Bend deductions: 3 × (90° = 2d) + 2 × (${hookAngle}° = ${hookAngle === 135 ? '3d' : '2d'}) = ${totalBendDeductions}mm`);

    // Total cutting length in mm and meters
    const cuttingLengthMm = SafeMath.round(2 * (a + b) + totalHookLength - totalBendDeductions, 1);
    const cuttingLengthM = SafeMath.round(cuttingLengthMm / 1000, 3);
    steps.push(`Total Stirrup Cut Length = 2(${a} + ${b}) + ${totalHookLength} - ${totalBendDeductions} = ${cuttingLengthMm}mm = ${cuttingLengthM}m`);

    const unitWeight = this.getUnitWeight(barDia);
    const singleWeightKg = SafeMath.round(cuttingLengthM * unitWeight, 3);

    return {
      barDiameterMm: barDia,
      coreWidthMm: a,
      coreDepthMm: b,
      hookLengthMm: hookLength,
      hookExtensionMm: hookLength,
      totalBendDeductionsMm: totalBendDeductions,
      bendDeductionsMm: totalBendDeductions,
      cuttingLengthMm,
      cuttingLengthM,
      unitWeightKgM: unitWeight,
      weightPerStirrupKg: singleWeightKg,
      calculationSteps: steps
    };
  }

  /**
   * Bar Bending Schedule calculation for multiple bar entries
   * @param {Array<Object>} scheduleEntries
   * [{
   *   mark: 'A1',
   *   description: 'Bottom Main Bars',
   *   diameterMm: 16,
   *   numberOfMembers: 4,
   *   barsPerMember: 3,
   *   cuttingLengthM: 4.85
   * }]
   */
  static generateSchedule(scheduleEntries) {
    if (!Array.isArray(scheduleEntries) || scheduleEntries.length === 0) {
      throw new Error('BBS schedule entries must be a non-empty array.');
    }

    const items = [];
    const diameterSummary = {};

    let grandTotalLengthM = 0;
    let grandTotalWeightKg = 0;

    scheduleEntries.forEach((entry, idx) => {
      const d = Number(entry.diameterMm) || 0;
      const members = Number(entry.numberOfMembers) || 1;
      const perMember = Number(entry.barsPerMember) || 1;
      const cutLen = Number(entry.cuttingLengthM) || 0;

      if (d <= 0 || cutLen <= 0) {
        throw new Error(`Invalid rebar entry at item ${idx + 1}: diameter and cut length must be positive.`);
      }

      const totalBars = members * perMember;
      const totalLenM = SafeMath.round(totalBars * cutLen, 3);
      const unitWeight = this.getUnitWeight(d);
      const totalWeightKg = SafeMath.round(totalLenM * unitWeight, 2);

      items.push({
        itemIndex: idx + 1,
        mark: entry.mark || `B-${idx + 1}`,
        description: entry.description || 'RCC Rebar',
        diameterMm: d,
        numberOfMembers: members,
        barsPerMember: perMember,
        totalBars,
        cuttingLengthM: cutLen,
        totalLengthM: totalLenM,
        unitWeightKgM: unitWeight,
        totalWeightKg
      });

      grandTotalLengthM = SafeMath.round(grandTotalLengthM + totalLenM, 3);
      grandTotalWeightKg = SafeMath.round(grandTotalWeightKg + totalWeightKg, 2);

      if (!diameterSummary[d]) {
        diameterSummary[d] = {
          diameterMm: d,
          totalLengthM: 0,
          unitWeightKgM: unitWeight,
          totalWeightKg: 0,
          totalWeightTonnes: 0
        };
      }
      diameterSummary[d].totalLengthM = SafeMath.round(diameterSummary[d].totalLengthM + totalLenM, 3);
      diameterSummary[d].totalWeightKg = SafeMath.round(diameterSummary[d].totalWeightKg + totalWeightKg, 2);
      diameterSummary[d].totalWeightTonnes = SafeMath.round(diameterSummary[d].totalWeightKg / 1000, 3);
    });

    return {
      scheduleItems: items,
      diameterBreakdown: Object.values(diameterSummary).sort((a, b) => a.diameterMm - b.diameterMm),
      totals: {
        totalLengthM: grandTotalLengthM,
        totalWeightKg: grandTotalWeightKg,
        totalWeightTonnes: SafeMath.round(grandTotalWeightKg / 1000, 3),
        totalWeightWith5PercentWastageKg: SafeMath.round(grandTotalWeightKg * 1.05, 2)
      },
      standardReference: 'IS 2502:1963 (Bar Bending Schedule) & IS 13920 (Ductile Detailing)'
    };
  }
}
