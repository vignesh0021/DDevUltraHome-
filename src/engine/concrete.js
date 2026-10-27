/**
 * Concrete Volume & Mix Estimation Module
 * Standard IS 456:2000 & Tamil Nadu PWD Engineering Practice
 */

import { SafeMath, UnitConverter, Validator } from './math.js';

export const CONCRETE_MIX_PROPORTIONS = {
  'M5': { cement: 1, sand: 5, aggregate: 10, targetStrength: 5, description: 'Lean concrete / sub-base' },
  'M7.5': { cement: 1, sand: 4, aggregate: 8, targetStrength: 7.5, description: 'Foundation PCC / trench beds' },
  'M10': { cement: 1, sand: 3, aggregate: 6, targetStrength: 10, description: 'Plain Cement Concrete (PCC), leveling course' },
  'M15': { cement: 1, sand: 2, aggregate: 4, targetStrength: 15, description: 'General PCC, pathway, light flooring' },
  'M20': { cement: 1, sand: 1.5, aggregate: 3, targetStrength: 20, description: 'Standard RCC for slabs, beams, columns (General Residential)' },
  'M25': { cement: 1, sand: 1, aggregate: 2, targetStrength: 25, description: 'Heavy RCC, footings, water tanks, coastal areas' },
  'M30': { cement: 1, sand: 0.75, aggregate: 1.5, targetStrength: 30, description: 'High strength RCC, heavy commercial / bridges' }
};

export const CONSTANTS = {
  DRY_VOLUME_FACTOR: 1.54,    // Standard IS code factor for dry volume of concrete (30-35% voids + 20% water shrinkage)
  CEMENT_BAG_WEIGHT_KG: 50,    // Standard 50 kg cement bag
  CEMENT_DENSITY_KG_M3: 1440,  // Standard bulk density of Portland cement
  SAND_DENSITY_KG_M3: 1600,    // Average bulk density of River Sand / M-Sand
  AGGREGATE_DENSITY_KG_M3: 1550, // Average bulk density of 20mm Blue Metal granite stone
  CFT_PER_M3: 35.3147,
  CFT_PER_TN_UNIT: 100         // 1 Tamil Nadu Unit (Brass) = 100 cft
};

export class ConcreteEngine {
  /**
   * Calculate required materials for concrete
   * @param {Object} params
   * @param {number} [params.volumeM3] - Direct volume in m³
   * @param {number} [params.length] - Length
   * @param {number} [params.width] - Width
   * @param {number} [params.depth] - Depth/thickness
   * @param {string} [params.dimensionUnit='m'] - Unit of dimensions ('m', 'ft', 'mm')
   * @param {string} [params.mixGrade='M20'] - Grade from CONCRETE_MIX_PROPORTIONS or 'CUSTOM'
   * @param {Object} [params.customRatio] - { cement: 1, sand: 1.5, aggregate: 3 }
   * @param {number} [params.dryFactor=1.54] - Dry volume conversion factor
   * @param {number} [params.waterCementRatio=0.50] - Water cement ratio by weight
   * @param {number} [params.wastagePercent=0] - Additional wastage allowance %
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    let wetVolume = 0;
    if (params.volumeM3 !== undefined && params.volumeM3 !== null) {
      const vCheck = Validator.positiveNumber('Concrete Volume', params.volumeM3);
      if (!vCheck.valid) throw new Error(vCheck.error);
      wetVolume = vCheck.value;
      steps.push(`Input wet concrete volume = ${wetVolume} m³`);
    } else {
      const lCheck = Validator.positiveNumber('Length', params.length);
      const wCheck = Validator.positiveNumber('Width', params.width);
      const dCheck = Validator.positiveNumber('Depth/Thickness', params.depth);
      if (!lCheck.valid) throw new Error(lCheck.error);
      if (!wCheck.valid) throw new Error(wCheck.error);
      if (!dCheck.valid) throw new Error(dCheck.error);

      const unit = (params.dimensionUnit || 'm').toLowerCase();
      let lM = lCheck.value;
      let wM = wCheck.value;
      let dM = dCheck.value;

      if (unit !== 'm') {
        lM = UnitConverter.convertLength(lCheck.value, unit, 'm');
        wM = UnitConverter.convertLength(wCheck.value, unit, 'm');
        dM = UnitConverter.convertLength(dCheck.value, unit, 'm');
        steps.push(`Converted dimensions from ${unit} to meters: L=${lM}m, W=${wM}m, D=${dM}m`);
      }

      wetVolume = SafeMath.round(lM * wM * dM, 4);
      steps.push(`Computed wet concrete volume = ${lM} × ${wM} × ${dM} = ${wetVolume} m³ (${SafeMath.round(wetVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);
    }

    if (wetVolume <= 0) {
      throw new Error('Concrete wet volume must be greater than zero.');
    }

    // Determine mix proportions
    const mixGrade = (params.mixGrade || 'M20').toUpperCase();
    let ratio = CONCRETE_MIX_PROPORTIONS[mixGrade];
    if (mixGrade === 'CUSTOM' || !ratio) {
      if (params.customRatio) {
        ratio = {
          cement: Number(params.customRatio.cement) || 1,
          sand: Number(params.customRatio.sand) || 1.5,
          aggregate: Number(params.customRatio.aggregate) || 3,
          description: 'Custom user defined mix proportion'
        };
      } else {
        ratio = CONCRETE_MIX_PROPORTIONS['M20'];
      }
    }

    const totalParts = SafeMath.round(ratio.cement + ratio.sand + ratio.aggregate, 4);
    steps.push(`Selected mix: ${mixGrade} (${ratio.cement} : ${ratio.sand} : ${ratio.aggregate}). Total ratio parts = ${totalParts}`);

    const dryFactor = Number(params.dryFactor) || CONSTANTS.DRY_VOLUME_FACTOR;
    assumptions.push(`Dry volume factor = ${dryFactor} (accounts for void filling and compaction)`);

    const wastage = Number(params.wastagePercent) || 0;
    const wastageMult = 1 + (wastage / 100);
    if (wastage > 0) {
      assumptions.push(`Wastage allowance = ${wastage}%`);
    }

    const effectiveDryVolume = SafeMath.round(wetVolume * dryFactor * wastageMult, 4);
    steps.push(`Dry concrete volume = ${wetVolume} × ${dryFactor} × ${wastageMult} = ${effectiveDryVolume} m³`);

    // 1. Cement calculation
    const cementVolumeM3 = SafeMath.round((ratio.cement / totalParts) * effectiveDryVolume, 4);
    const cementKg = SafeMath.round(cementVolumeM3 * CONSTANTS.CEMENT_DENSITY_KG_M3, 2);
    const cementBags = SafeMath.round(cementKg / CONSTANTS.CEMENT_BAG_WEIGHT_KG, 2);
    assumptions.push(`Cement bulk density = ${CONSTANTS.CEMENT_DENSITY_KG_M3} kg/m³, 50 kg per bag`);
    steps.push(`Cement Volume = (${ratio.cement} / ${totalParts}) × ${effectiveDryVolume} = ${cementVolumeM3} m³`);
    steps.push(`Cement Weight = ${cementVolumeM3} m³ × ${CONSTANTS.CEMENT_DENSITY_KG_M3} kg/m³ = ${cementKg} kg (~${Math.ceil(cementBags)} bags)`);

    // 2. Sand calculation
    const sandVolumeM3 = SafeMath.round((ratio.sand / totalParts) * effectiveDryVolume, 4);
    const sandCft = SafeMath.round(sandVolumeM3 * CONSTANTS.CFT_PER_M3, 2);
    const sandUnits = SafeMath.round(sandCft / CONSTANTS.CFT_PER_TN_UNIT, 3);
    const sandTonnes = SafeMath.round((sandVolumeM3 * CONSTANTS.SAND_DENSITY_KG_M3) / 1000, 3);
    assumptions.push(`Sand bulk density = ${CONSTANTS.SAND_DENSITY_KG_M3} kg/m³, 1 TN Unit = 100 cft`);
    steps.push(`Sand Volume = (${ratio.sand} / ${totalParts}) × ${effectiveDryVolume} = ${sandVolumeM3} m³ = ${sandCft} cft (${sandUnits} TN Units)`);

    // 3. Aggregate calculation
    const aggVolumeM3 = SafeMath.round((ratio.aggregate / totalParts) * effectiveDryVolume, 4);
    const aggCft = SafeMath.round(aggVolumeM3 * CONSTANTS.CFT_PER_M3, 2);
    const aggUnits = SafeMath.round(aggCft / CONSTANTS.CFT_PER_TN_UNIT, 3);
    const aggTonnes = SafeMath.round((aggVolumeM3 * CONSTANTS.AGGREGATE_DENSITY_KG_M3) / 1000, 3);
    assumptions.push(`Coarse Aggregate (Blue Metal) density = ${CONSTANTS.AGGREGATE_DENSITY_KG_M3} kg/m³`);
    steps.push(`Coarse Aggregate Volume = (${ratio.aggregate} / ${totalParts}) × ${effectiveDryVolume} = ${aggVolumeM3} m³ = ${aggCft} cft (${aggUnits} TN Units)`);

    // 4. Water calculation
    const wcRatio = Number(params.waterCementRatio) || 0.50;
    const waterLitres = SafeMath.round(cementKg * wcRatio, 1);
    assumptions.push(`Water-Cement ratio = ${wcRatio} (approx ${SafeMath.round(wcRatio * 50, 1)} Litres per 50kg bag)`);
    steps.push(`Water Quantity = ${cementKg} kg × ${wcRatio} = ${waterLitres} Litres`);

    return {
      success: true,
      mixGrade,
      proportions: ratio,
      wetVolumeM3: wetVolume,
      wetVolumeCft: SafeMath.round(wetVolume * CONSTANTS.CFT_PER_M3, 2),
      dryVolumeM3: effectiveDryVolume,
      materials: {
        cement: {
          volumeM3: cementVolumeM3,
          weightKg: cementKg,
          bags: cementBags,
          bagsRounded: Math.ceil(cementBags),
          unit: '50kg Bags'
        },
        sand: {
          volumeM3: sandVolumeM3,
          volumeCft: sandCft,
          tnUnits: sandUnits,
          weightTonnes: sandTonnes,
          unit: 'cft / TN Units'
        },
        aggregate: {
          volumeM3: aggVolumeM3,
          volumeCft: aggCft,
          tnUnits: aggUnits,
          weightTonnes: aggTonnes,
          unit: 'cft / TN Units'
        },
        water: {
          quantityLitres: waterLitres,
          unit: 'Litres'
        }
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'This estimation is for material quantity take-off and preliminary budgeting. Site workability, slump requirements, and structural specifications should follow approved structural drawings and IS 456 / IS 10262 mix designs.'
    };
  }
}
