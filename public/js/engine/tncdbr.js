/**
 * Tamil Nadu Combined Development and Building Rules (TNCDBR 2019)
 * Planning Permission & Statutory Building Rule Validator
 * Applicable across Chennai (CMDA) and all Tamil Nadu Districts (DTCP)
 */

import { SafeMath, Validator } from './math.js';

export class TncdbrEngine {
  /**
   * Validate Non-High Rise Residential Building Plan against TNCDBR 2019
   * @param {Object} params
   * @param {number} params.plotAreaSqft - Total plot area in sq.ft (e.g. 2400 sq.ft = 1 Ground)
   * @param {number} params.roadWidthM - Abutting street/road width in meters (e.g. 7.2m, 9.14m = 30ft)
   * @param {number} params.proposedGroundFloorSqft - Ground coverage built-up area
   * @param {number} params.proposedTotalBuiltupSqft - Total floor area across all floors
   * @param {number} [params.buildingHeightM=7.5] - Total building height in meters (e.g. 7.5m for G+1)
   * @param {number} [params.frontSetbackM=1.5] - Proposed front setback in meters
   * @param {number} [params.rearSetbackM=1.5] - Proposed rear setback in meters
   * @param {number} [params.side1SetbackM=1.0] - Proposed side 1 setback in meters
   * @param {number} [params.side2SetbackM=1.0] - Proposed side 2 setback in meters
   */
  static validateResidentialPlan(params) {
    const steps = [];
    const violations = [];

    const plotCheck = Validator.positiveNumber('Plot Area', params.plotAreaSqft);
    const roadCheck = Validator.positiveNumber('Road Width', params.roadWidthM);
    const gfCheck = Validator.positiveNumber('Ground Floor Area', params.proposedGroundFloorSqft);
    const totCheck = Validator.positiveNumber('Total Built-up Area', params.proposedTotalBuiltupSqft);

    if (!plotCheck.valid) throw new Error(plotCheck.error);
    if (!roadCheck.valid) throw new Error(roadCheck.error);
    if (!gfCheck.valid) throw new Error(gfCheck.error);
    if (!totCheck.valid) throw new Error(totCheck.error);

    const plotSqft = plotCheck.value;
    const roadM = roadCheck.value;
    const gfSqft = gfCheck.value;
    const totalSqft = totCheck.value;
    const heightM = Number(params.buildingHeightM) || 7.5;

    steps.push(`Site Details: Plot Area = ${plotSqft} sq.ft (${SafeMath.round(plotSqft / 2400, 2)} Grounds), Abutting Road Width = ${roadM}m (${SafeMath.round(roadM * 3.28084, 1)} ft)`);
    steps.push(`Proposed Proposal: Ground Floor = ${gfSqft} sq.ft, Total Built-up = ${totalSqft} sq.ft, Height = ${heightM}m`);

    // 1. Plot Coverage Check (TNCDBR 2019 Rule 39 Table 6: Maximum permissible coverage = 70%)
    const maxCoveragePct = 70.0;
    const actualCoveragePct = SafeMath.round((gfSqft / plotSqft) * 100, 2);
    const maxAllowedGroundFloorSqft = SafeMath.round(plotSqft * 0.70, 1);
    const isCoveragePass = actualCoveragePct <= maxCoveragePct;

    steps.push(`Plot Coverage: Proposed = ${actualCoveragePct}% (Max Allowed = ${maxCoveragePct}% / ${maxAllowedGroundFloorSqft} sq.ft)`);
    if (!isCoveragePass) {
      violations.push(`Plot Coverage violation: Proposed ground floor (${gfSqft} sq.ft / ${actualCoveragePct}%) exceeds maximum permissible 70% (${maxAllowedGroundFloorSqft} sq.ft).`);
    }

    // 2. Floor Space Index (FSI) Check per TNCDBR 2019 Rule 39
    // Road width < 9.0m: FSI = 1.50
    // Road width 9.0m to 12.0m: FSI = 1.75
    // Road width > 12.0m: FSI = 2.00
    let permissibleFsi = 1.50;
    if (roadM >= 12.0) {
      permissibleFsi = 2.00;
    } else if (roadM >= 9.0) {
      permissibleFsi = 1.75;
    }

    const maxAllowedTotalSqft = SafeMath.round(plotSqft * permissibleFsi, 1);
    const actualFsi = SafeMath.round(totalSqft / plotSqft, 2);
    const isFsiPass = actualFsi <= permissibleFsi;

    steps.push(`FSI Analysis: Permissible FSI for ${roadM}m road = ${permissibleFsi} (Max Total Built-up = ${maxAllowedTotalSqft} sq.ft). Proposed FSI = ${actualFsi} (${totalSqft} sq.ft)`);
    if (!isFsiPass) {
      violations.push(`FSI violation: Proposed built-up area (${totalSqft} sq.ft / FSI ${actualFsi}) exceeds maximum permissible FSI ${permissibleFsi} (${maxAllowedTotalSqft} sq.ft). Reduce area by ${SafeMath.round(totalSqft - maxAllowedTotalSqft, 1)} sq.ft or purchase Premium FSI.`);
    }

    // 3. Minimum Setbacks Validation per TNCDBR Rule 39 (Non-High Rise up to 12m)
    // Front Setback:
    let minFrontM = 1.5;
    if (roadM >= 18.0) minFrontM = 4.5;
    else if (roadM >= 9.0) minFrontM = 3.0;

    const propFrontM = Number(params.frontSetbackM) !== undefined ? Number(params.frontSetbackM) : 1.5;
    const isFrontPass = propFrontM >= minFrontM;
    steps.push(`Front Setback: Required min = ${minFrontM}m, Proposed = ${propFrontM}m => ${isFrontPass ? 'PASS' : 'VIOLATION'}`);
    if (!isFrontPass) {
      violations.push(`Front setback violation: Proposed ${propFrontM}m is less than mandatory ${minFrontM}m for ${roadM}m road.`);
    }

    // Rear Setback: min 1.5m for height up to 7m, 2.0m for height up to 12m
    const minRearM = heightM <= 7.0 ? 1.5 : 2.0;
    const propRearM = Number(params.rearSetbackM) !== undefined ? Number(params.rearSetbackM) : 1.5;
    const isRearPass = propRearM >= minRearM;
    steps.push(`Rear Setback: Required min = ${minRearM}m (Height ${heightM}m), Proposed = ${propRearM}m => ${isRearPass ? 'PASS' : 'VIOLATION'}`);
    if (!isRearPass) {
      violations.push(`Rear setback violation: Proposed ${propRearM}m is less than mandatory ${minRearM}m.`);
    }

    // Side Setbacks: min 1.0m to 1.5m
    const minSideM = heightM <= 7.0 ? 1.0 : 1.5;
    const propSide1M = Number(params.side1SetbackM) !== undefined ? Number(params.side1SetbackM) : 1.0;
    const propSide2M = Number(params.side2SetbackM) !== undefined ? Number(params.side2SetbackM) : 1.0;
    const isSide1Pass = propSide1M >= minSideM;
    const isSide2Pass = propSide2M >= minSideM;
    steps.push(`Side Setbacks: Required min = ${minSideM}m each side. Proposed = Side 1: ${propSide1M}m, Side 2: ${propSide2M}m`);
    if (!isSide1Pass || !isSide2Pass) {
      violations.push(`Side setback violation: Proposed side setbacks (Side 1: ${propSide1M}m, Side 2: ${propSide2M}m) are less than mandatory ${minSideM}m.`);
    }

    const isFullyCompliant = violations.length === 0;

    return {
      isCompliant: isFullyCompliant,
      status: isFullyCompliant ? 'APPROVED_COMPLIANT' : 'PLAN_VIOLATIONS_DETECTED',
      verdict: isFullyCompliant 
        ? 'Plan complies with Tamil Nadu Combined Development and Building Rules, 2019 (TNCDBR).' 
        : 'Plan does not comply with TNCDBR 2019. See violations list before submitting to CMDA/DTCP.',
      metrics: {
        plotAreaSqft: plotSqft,
        roadWidthM: roadM,
        plotCoverage: {
          proposedPct: actualCoveragePct,
          maxAllowedPct: maxCoveragePct,
          isPass: isCoveragePass
        },
        fsi: {
          proposedFsi: actualFsi,
          permissibleFsi: permissibleFsi,
          maxAllowedBuiltupSqft: maxAllowedTotalSqft,
          surplusOrDeficitSqft: SafeMath.round(maxAllowedTotalSqft - totalSqft, 1),
          isPass: isFsiPass
        },
        setbacks: {
          front: { requiredM: minFrontM, proposedM: propFrontM, isPass: isFrontPass },
          rear: { requiredM: minRearM, proposedM: propRearM, isPass: isRearPass },
          side1: { requiredM: minSideM, proposedM: propSide1M, isPass: isSide1Pass },
          side2: { requiredM: minSideM, proposedM: propSide2M, isPass: isSide2Pass }
        }
      },
      violations,
      calculationSteps: steps,
      statutoryReference: 'Tamil Nadu Combined Development and Building Rules, 2019 (G.O. Ms. No. 18 MAWS Dept)'
    };
  }
}
