/**
 * Coastal Durability & Exposure Compliance Engine
 * In accordance with IS 456:2000 (Clauses 8.2, 26.4, Tables 3, 5, and 16)
 * Specifically calibrated for Chennai Coastal Marine & Inland Tamil Nadu environments
 */

import { SafeMath } from './math.js';

export const EXPOSURE_CONDITIONS = {
  'MILD': {
    name: 'Mild Exposure',
    description: 'Concrete surfaces completely protected against weather or aggressive conditions (Dry inland interior zones like Salem, Karur)',
    minRccGrade: 'M20',
    minCementKgM3: 300,
    maxWaterCementRatio: 0.55,
    nominalCoversMm: { slab: 20, beam: 25, column: 40, footing: 50 },
    rebarRecommendation: 'Fe550D High Ductility TMT'
  },
  'MODERATE': {
    name: 'Moderate Exposure',
    description: 'Sheltered from severe rain, continually under water, or concrete in contact with non-aggressive soils (Tambaram, Kanchipuram, Coimbatore)',
    minRccGrade: 'M25',
    minCementKgM3: 300,
    maxWaterCementRatio: 0.50,
    nominalCoversMm: { slab: 30, beam: 30, column: 40, footing: 50 },
    rebarRecommendation: 'Fe550D TMT with Anti-Corrosive Cementitious Coating'
  },
  'SEVERE': {
    name: 'Severe (Chennai Coastal Standard)',
    description: 'Concrete exposed to coastal environment, sea air, alternate wetting and drying, or severe condensation (OMR, Velachery, Central Chennai within 15 km from Bay of Bengal)',
    minRccGrade: 'M30',
    minCementKgM3: 320,
    maxWaterCementRatio: 0.45,
    nominalCoversMm: { slab: 35, beam: 45, column: 45, footing: 50 },
    rebarRecommendation: 'CRS (Corrosion Resistant Steel) Fe500D / Fe550D with Cu+Cr+P alloying'
  },
  'VERY_SEVERE': {
    name: 'Very Severe (Direct Marine Spray / Beachfront)',
    description: 'Direct sea water spray, tidal zone, coastal fog, or saline groundwater (ECR, Besant Nagar, Marina, Thiruvanmiyur, Ennore Coastal Strip)',
    minRccGrade: 'M35',
    minCementKgM3: 340,
    maxWaterCementRatio: 0.45,
    nominalCoversMm: { slab: 45, beam: 50, column: 50, footing: 75 },
    rebarRecommendation: 'CRS TMT + Integral Corrosion Inhibitor Admixture (or Fusion Bonded Epoxy Coating IS 13620)'
  }
};

export class DurabilityEngine {
  /**
   * Evaluate structural concrete mix and clear cover specifications against IS 456 durability tables
   * @param {Object} params
   * @param {string} [params.exposureCondition='SEVERE'] - Key from EXPOSURE_CONDITIONS
   * @param {string} params.proposedGrade - E.g. 'M20', 'M25', 'M30', 'M35'
   * @param {number} [params.proposedCoverMm=25] - Clear cover proposed in design
   * @param {string} [params.elementType='SLAB'] - 'SLAB', 'BEAM', 'COLUMN', 'FOOTING'
   * @param {number} [params.waterCementRatio=0.50] - Proposed W/C ratio
   */
  static evaluate(params) {
    const steps = [];
    const warnings = [];

    let expKey = (params.exposureCondition || '').toUpperCase();
    if (!expKey && params.coastalDistance) {
      if (params.coastalDistance === 'COASTAL_CRITICAL') expKey = 'VERY_SEVERE';
      else if (params.coastalDistance === 'COASTAL_MODERATE') expKey = 'SEVERE';
      else expKey = 'MODERATE';
    }
    if (!expKey) expKey = 'SEVERE';

    const config = EXPOSURE_CONDITIONS[expKey] || EXPOSURE_CONDITIONS['SEVERE'];
    
    let elem = (params.elementType || '').toLowerCase();
    if (!elem && params.structuralElement) {
      elem = params.structuralElement === 'SUBSTRUCTURE' ? 'footing' : 'column';
    }
    if (!elem) elem = 'slab';

    steps.push(`Selected Exposure Category: ${config.name}`);
    steps.push(`Environmental Description: ${config.description}`);

    const gradeOrder = { 'M15': 15, 'M20': 20, 'M25': 25, 'M30': 30, 'M35': 35, 'M40': 40 };
    const propGradeStr = (params.proposedGrade || 'M20').toUpperCase();
    const propGradeVal = gradeOrder[propGradeStr] || 20;
    const minGradeVal = gradeOrder[config.minRccGrade] || 30;

    const isGradeSufficient = propGradeVal >= minGradeVal;
    steps.push(`Proposed Grade: ${propGradeStr} (Characteristic strength ${propGradeVal} N/mm²), IS 456 Minimum Required = ${config.minRccGrade} (${minGradeVal} N/mm²)`);

    if (!isGradeSufficient) {
      warnings.push(`⚠️ GRADE DEFICIT: Under IS 456 Table 5, ${config.name} strictly mandates minimum ${config.minRccGrade} for reinforced concrete. Using ${propGradeStr} will cause accelerated chloride-induced rebar corrosion.`);
    }

    const minCover = config.nominalCoversMm[elem] || config.nominalCoversMm['slab'];
    const propCover = Number(params.proposedCoverMm) || (elem === 'footing' ? 50 : 25);
    const isCoverSufficient = propCover >= minCover;
    steps.push(`Element: ${elem.toUpperCase()}, Proposed Cover = ${propCover}mm, IS 456 Table 16 Mandatory Nominal Cover = ${minCover}mm`);

    if (!isCoverSufficient) {
      warnings.push(`⚠️ COVER DEFICIT: Proposed cover of ${propCover}mm is below IS 456 minimum ${minCover}mm for ${elem.toUpperCase()} in ${config.name}. Salt-laden sea air can penetrate concrete carbonation depth rapidly.`);
    }

    const propWc = Number(params.waterCementRatio) || 0.50;
    const isWcSufficient = propWc <= config.maxWaterCementRatio;
    steps.push(`Water-Cement Ratio: Proposed = ${propWc}, IS 456 Maximum Limit = ${config.maxWaterCementRatio}`);

    if (!isWcSufficient) {
      warnings.push(`⚠️ WATER-CEMENT EXCESS: W/C ratio of ${propWc} exceeds maximum limit ${config.maxWaterCementRatio}. Excessive porosity will permit capillary ingress of saline moisture.`);
    }

    const isFullyCompliant = isGradeSufficient && isCoverSufficient && isWcSufficient;

    return {
      exposureCategory: config.name,
      // Frontend UI convenience aliases
      exposureCondition: config.name,
      minConcreteGrade: config.minRccGrade,
      minNominalCoverMm: minCover,
      maxWaterCementRatio: config.maxWaterCementRatio,
      complianceStatus: isFullyCompliant ? 'DURABILITY_COMPLIANT' : 'NON_COMPLIANT_CORROSION_RISK',
      verdict: isFullyCompliant
        ? `Compliant with IS 456:2000 Durability provisions for ${config.name}.`
        : `Deficits identified. Modifications required to prevent early corrosion and spalling.`,
      specifications: {
        minimumConcreteGrade: config.minRccGrade,
        proposedConcreteGrade: propGradeStr,
        minimumCementContentKgM3: config.minCementKgM3,
        maximumWaterCementRatio: config.maxWaterCementRatio,
        proposedWaterCementRatio: propWc,
        mandatoryNominalCoverMm: minCover,
        proposedNominalCoverMm: propCover,
        rebarSpecification: config.rebarRecommendation
      },
      warnings,
      calculationSteps: steps,
      standardReference: 'IS 456:2000 Table 3, Table 5 (Durability Requirements) & Table 16'
    };
  }
}
