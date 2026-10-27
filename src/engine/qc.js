/**
 * Concrete Quality Control & Cube Compressive Strength Test Engine
 * In accordance with IS 516:1959 and IS 456:2000 Clause 15 (Acceptance Criteria)
 */

import { SafeMath, Validator } from './math.js';

export const CUBE_CROSS_SECTION_MM2 = 22500; // 150mm x 150mm standard cube

export const CHARACTERISTIC_STRENGTH = {
  'M15': 15.0,
  'M20': 20.0,
  'M25': 25.0,
  'M30': 30.0,
  'M35': 35.0,
  'M40': 40.0
};

export class ConcreteQcEngine {
  /**
   * Evaluate Concrete Cube Compressive Strength Test Batch
   * @param {Object} params
   * @param {string} params.grade - Concrete mix grade (e.g. 'M20', 'M25')
   * @param {number} params.testAgeDays - Age at test: 7 or 28 days
   * @param {Array<number>} params.breakingLoadsKn - Array of 3 failure loads from CTM in kN (e.g. [310, 320, 315])
   * @param {string} [params.castingDate] - Date of casting
   * @param {string} [params.testingDate] - Date of testing
   * @param {string} [params.elementName='RCC Element'] - Structural member tested (e.g. 'Roof Slab Flight-1')
   * @param {number} [params.slumpMm=100] - Measured slump in mm during pour
   */
  static evaluateBatch(params) {
    const steps = [];
    const assumptions = [];

    const grade = (params.grade || 'M20').toUpperCase();
    const fck = CHARACTERISTIC_STRENGTH[grade] || 20.0;
    const age = Number(params.testAgeDays) === 7 ? 7 : 28;
    const loads = Array.isArray(params.breakingLoadsKn) ? params.breakingLoadsKn : [];

    if (loads.length < 3) {
      throw new Error('A valid test batch requires at least 3 cube specimen failure loads per IS 516.');
    }

    steps.push(`Tested Concrete Grade: ${grade} (Characteristic strength fck = ${fck} N/mm²)`);
    steps.push(`Test Age: ${age} Days, Specimen Size = 150mm × 150mm × 150mm (Area = 22,500 mm²)`);

    // 1. Calculate individual compressive strengths
    const individualStrengths = loads.slice(0, 3).map((loadKn, idx) => {
      const load = Number(loadKn) || 0;
      if (load <= 0) throw new Error(`Cube specimen #${idx + 1} has an invalid breaking load.`);
      // Strength (N/mm²) = (Load in kN * 1000) / 22500 mm²
      const strength = SafeMath.round((load * 1000) / CUBE_CROSS_SECTION_MM2, 2);
      steps.push(`Cube #${idx + 1}: Breaking load = ${load} kN => Compressive Strength = (${load} × 1000) / 22500 = ${strength} N/mm²`);
      return {
        cubeNumber: idx + 1,
        breakingLoadKn: load,
        compressiveStrengthNmm2: strength
      };
    });

    // 2. Average compressive strength
    const sumStrength = individualStrengths.reduce((acc, c) => acc + c.compressiveStrengthNmm2, 0);
    const averageStrength = SafeMath.round(sumStrength / 3, 2);
    steps.push(`Average Compressive Strength = (${individualStrengths.map(c => c.compressiveStrengthNmm2).join(' + ')}) / 3 = ${averageStrength} N/mm²`);

    // 3. Statistical variation check per IS 456 Clause 15.4
    // The individual variation must not be more than ±15% of the average
    let hasVariationAnomaly = false;
    const maxAllowedVariation = SafeMath.round(averageStrength * 0.15, 2);
    assumptions.push(`IS 456 Clause 15.4 Acceptance rule: Individual cube strengths must not deviate by more than ±15% (±${maxAllowedVariation} N/mm²) from the average`);

    individualStrengths.forEach(c => {
      const diff = Math.abs(c.compressiveStrengthNmm2 - averageStrength);
      const pctDiff = SafeMath.round((diff / averageStrength) * 100, 1);
      c.percentageDeviation = pctDiff;
      c.isDeviationValid = pctDiff <= 15.0;
      if (pctDiff > 15.0) {
        hasVariationAnomaly = true;
        steps.push(`⚠️ WARNING: Cube #${c.cubeNumber} deviates by ${pctDiff}% (> 15% limit) from average.`);
      }
    });

    // 4. Target strength criteria
    // 7 Days: Minimum 65% of fck
    // 28 Days: Minimum 100% of fck
    let targetStrengthNmm2 = 0;
    if (age === 7) {
      targetStrengthNmm2 = SafeMath.round(fck * 0.67, 2); // ~67% standard
      steps.push(`Target 7-Day Strength threshold: 67% of ${fck} = ${targetStrengthNmm2} N/mm²`);
    } else {
      targetStrengthNmm2 = fck;
      steps.push(`Target 28-Day Strength threshold: 100% of ${fck} = ${targetStrengthNmm2} N/mm²`);
    }

    const isStrengthAchieved = averageStrength >= targetStrengthNmm2;
    const overallPass = isStrengthAchieved && !hasVariationAnomaly;
    const percentAchieved = SafeMath.round((averageStrength / fck) * 100, 1);

    return {
      grade,
      characteristicStrengthFck: fck,
      testAgeDays: age,
      elementTested: params.elementName || 'RCC Structural Member',
      slumpMm: params.slumpMm || 100,
      specimens: individualStrengths,
      averageStrengthNmm2: averageStrength,
      targetStrengthNmm2: targetStrengthNmm2,
      percentOfFckAchieved: percentAchieved,
      isVariationWithin15Percent: !hasVariationAnomaly,
      isStrengthAchieved,
      resultStatus: overallPass ? 'PASS' : (isStrengthAchieved ? 'MARGINAL_VARIATION' : 'FAIL'),
      remarks: overallPass 
        ? `Compliant with IS 456. Concrete has achieved ${percentAchieved}% of characteristic strength at ${age} days.`
        : (hasVariationAnomaly 
            ? 'Average strength passed but individual cube deviation exceeded 15%. Batch uniformity requires re-inspection.' 
            : `Failed to achieve target strength at ${age} days. Review water-cement ratio and curing on site.`),
      assumptions,
      calculationSteps: steps,
      standardReference: 'IS 516:1959 (Method of Tests for Strength of Concrete) & IS 456:2000'
    };
  }
}
