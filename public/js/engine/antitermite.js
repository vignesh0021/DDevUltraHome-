/**
 * Anti-Termite Pre-Construction Treatment Engine
 * In accordance with IS 6313 (Part 2): 2013
 * Mandatory for CMDA / DTCP Building Approvals & Foundation Protection
 */

import { SafeMath, Validator } from './math.js';

export const CHEMICAL_CONFIG = {
  'CHLORPYRIFOS_20EC': {
    name: 'Chlorpyrifos 20% EC',
    dilutionRatio: 19, // 1 part chemical to 19 parts water (1:19 = 1.0% active ingredient)
    description: 'Standard organophosphate emulsion per IS 8944'
  },
  'IMIDACLOPRID_30SC': {
    name: 'Imidacloprid 30.50% SC',
    dilutionRatio: 229, // 1 part chemical to 229 parts water (1:229 = 0.075% active ingredient)
    description: 'Low-odor non-repellent modern termiticide'
  }
};

export class AntiTermiteEngine {
  /**
   * Calculate chemical and water emulsion requirements per IS 6313 Part 2
   * @param {Object} params
   * @param {number} params.plinthAreaM2 - Plinth / Ground floor area in sq.meters
   * @param {number} [params.perimeterM] - External perimeter of building in meters
   * @param {number} [params.trenchAreaM2] - Bottom & sides area of foundation trenches in sq.m
   * @param {string} [params.chemical='CHLORPYRIFOS_20EC'] - Key from CHEMICAL_CONFIG
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const plinthInput = params.plinthAreaM2 !== undefined ? params.plinthAreaM2 : (params.plinthAreaSqft ? params.plinthAreaSqft / 10.7639 : null);
    const aCheck = Validator.positiveNumber('Plinth Area', plinthInput);
    if (!aCheck.valid) throw new Error(aCheck.error);
    const plinthM2 = aCheck.value;
    const plinthSqft = SafeMath.round(plinthM2 * 10.7639, 1);

    const perimM = Number(params.perimeterM || params.perimeterLengthM) || Math.round(Math.sqrt(plinthM2) * 4);
    const trenchM2 = Number(params.trenchAreaM2) || SafeMath.round(plinthM2 * 0.60, 2);

    const chemKey = params.chemical || params.chemicalType || 'CHLORPYRIFOS_20EC';
    const chem = CHEMICAL_CONFIG[chemKey] || CHEMICAL_CONFIG['CHLORPYRIFOS_20EC'];
    steps.push(`Selected Chemical: ${chem.name} (Dilution: 1 Part Chemical + ${chem.dilutionRatio} Parts Water)`);

    // Stage 1: Trench bottom and sides (5 Litres / m²)
    const stage1Litres = SafeMath.round(trenchM2 * 5.0, 1);
    steps.push(`Stage 1 (Trench Bed & Sides): ${trenchM2} m² × 5.0 L/m² = ${stage1Litres} Litres`);

    // Stage 2: Backfill along masonry walls & columns (7.5 Litres / m² of vertical face, approx 40% of plinth)
    const backfillAreaM2 = SafeMath.round(plinthM2 * 0.40, 2);
    const stage2Litres = SafeMath.round(backfillAreaM2 * 7.5, 1);
    steps.push(`Stage 2 (Refilled Backfill Soil): ${backfillAreaM2} m² × 7.5 L/m² = ${stage2Litres} Litres`);

    // Stage 3: Subgrade under plinth floor before PCC (5 Litres / m²)
    const stage3Litres = SafeMath.round(plinthM2 * 5.0, 1);
    steps.push(`Stage 3 (Plinth Floor Sub-base): ${plinthM2} m² × 5.0 L/m² = ${stage3Litres} Litres`);

    // Stage 4: External perimeter rodding along outer wall (7.5 Litres per linear meter)
    const stage4Litres = SafeMath.round(perimM * 7.5, 1);
    steps.push(`Stage 4 (External Building Perimeter Barrier): ${perimM}m × 7.5 L/m = ${stage4Litres} Litres`);

    const totalEmulsionLitres = SafeMath.round(stage1Litres + stage2Litres + stage3Litres + stage4Litres, 1);
    steps.push(`Total Chemical Emulsion Required = ${totalEmulsionLitres} Litres`);

    // Concentrated chemical vs water calculation
    // Total parts = 1 + dilutionRatio (e.g. 1 + 19 = 20)
    const totalParts = 1 + chem.dilutionRatio;
    const chemicalLitres = SafeMath.round(totalEmulsionLitres / totalParts, 2);
    const waterLitres = SafeMath.round(totalEmulsionLitres - chemicalLitres, 1);

    const cans5Litre = Math.ceil(chemicalLitres / 5);
    assumptions.push(`Chemical active concentration meets IS 6313 Part 2 standards`);
    steps.push(`Concentrated Chemical Required = ${totalEmulsionLitres} / ${totalParts} = ${chemicalLitres} Litres (~${cans5Litre} cans of 5L)`);
    steps.push(`Clean Water for Dilution = ${waterLitres} Litres`);

    return {
      chemicalName: chem.name,
      chemicalType: chem.name,
      plinthAreaSqft: plinthSqft,
      areas: { plinthAreaM2: plinthM2, perimeterM: perimM, trenchAreaM2: trenchM2 },
      stagesLitres: {
        stage1Trench: stage1Litres,
        stage2Backfill: stage2Litres,
        stage3PlinthBed: stage3Litres,
        stage4Perimeter: stage4Litres
      },
      totalEmulsionLitres,
      concentratedChemicalLitres: chemicalLitres,
      chemicalConcentrateLitres: chemicalLitres,
      cans5LitreRequired: cans5Litre,
      waterLitresRequired: waterLitres,
      assumptions,
      calculationSteps: steps,
      standardReference: 'IS 6313 (Part 2): 2013 - Code of practice for anti-termite measures in buildings'
    };
  }
}
