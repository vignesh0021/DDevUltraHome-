/**
 * Post-Flood Plinth Protection & Damp Proof Course (DPC) Engine
 * Designed for Greater Chennai Corporation (GCC) Post-Michaung Flood Mitigation & High Water-Table Protection
 */

import { SafeMath, Validator } from './math.js';

export class PlinthEngine {
  /**
   * Sizing and Material Take-Off for Plinth Height Protection, Moorum Compaction & DPC Waterproofing
   * @param {Object} params
   * @param {number} params.plinthAreaSqft - Plinth / Ground floor footprint area in sq.ft
   * @param {number} params.plinthHeightAboveRoadMm - Height of proposed plinth above road center crown (min 600mm recommended)
   * @param {number} [params.roadCrownLevelMm=0] - Existing road level
   * @param {number} [params.plinthWallPerimeterM] - Total perimeter of plinth beam / foundation walls for DPC
   */
  static calculate(params) {
    const steps = [];
    const warnings = [];

    const aCheck = Validator.positiveNumber('Plinth Area', params.plinthAreaSqft);
    if (!aCheck.valid) throw new Error(aCheck.error);
    const plinthSqft = aCheck.value;
    const plinthM2 = SafeMath.round(plinthSqft / 10.7639, 2);

    const proposedPlinthHeightMm = Number(params.plinthHeightAboveRoadMm) || 600;
    const minMandatoryPlinthHeightMm = 600; // Post-Michaung 2-ft guideline

    steps.push(`Plinth Footprint: ${plinthSqft} sq.ft (${plinthM2} m²)`);
    steps.push(`Proposed Plinth Level: +${proposedPlinthHeightMm} mm (${SafeMath.round(proposedPlinthHeightMm / 304.8, 2)} ft) above finished road center`);

    // 1. Flood Safety Check against GCC Guidelines
    const isFloodSafe = proposedPlinthHeightMm >= minMandatoryPlinthHeightMm;
    if (!isFloodSafe) {
      warnings.push(`⚠️ FLOOD INUNDATION RISK: Proposed plinth height of ${proposedPlinthHeightMm}mm is below the mandatory +600mm (2.0 ft) GCC flood safety norm. Surface runoff from street will enter premises during heavy northeast monsoons.`);
    }

    // 2. Earth / Gravel Moorum Filling Volume
    // Height of earth filling = Plinth height - floor concrete (100mm) - sand cushion (100mm)
    const earthFillHeightM = Math.max(0.2, SafeMath.round((proposedPlinthHeightMm - 200) / 1000, 3));
    const netFillVolumeM3 = SafeMath.round(plinthM2 * earthFillHeightM, 2);
    
    // Moorum compaction factor: 1.25 (25% shrinkage upon flooding & mechanical plate ramming)
    const compactionFactor = 1.25;
    const looseMoorumRequiredM3 = SafeMath.round(netFillVolumeM3 * compactionFactor, 2);
    const moorumCft = SafeMath.round(looseMoorumRequiredM3 * 35.3147, 1);
    const moorumTnUnits = SafeMath.round(moorumCft / 100, 2);

    steps.push(`Moorum Earth Filling: Net compacted volume = ${netFillVolumeM3} m³ (Height: ${earthFillHeightM}m)`);
    steps.push(`Loose Red Earth / Gravel Moorum Required (1.25 compaction factor) = ${looseMoorumRequiredM3} m³ (${moorumCft} cft / ${moorumTnUnits} TN Units)`);

    // 3. Sand Cushion Bedding under Ground Floor PCC (100mm thickness)
    const sandCushionM3 = SafeMath.round(plinthM2 * 0.10, 2);
    const sandCft = SafeMath.round(sandCushionM3 * 35.3147, 1);
    const sandTnUnits = SafeMath.round(sandCft / 100, 2);
    steps.push(`Under-Floor Sand Cushion (100mm): ${sandCushionM3} m³ (${sandCft} cft / ${sandTnUnits} TN Units)`);

    // 4. Damp Proof Course (DPC) per IS 2645 & CPWD Spec
    // 50mm thick M15/M20 concrete (1:2:4) with integral waterproofing compound over plinth walls
    const perimM = Number(params.plinthWallPerimeterM) || SafeMath.round(Math.sqrt(plinthM2) * 4 * 1.5, 1); // External + internal plinth beams
    const plinthWallWidthM = 0.23; // 9-inch wall / beam
    const dpcAreaM2 = SafeMath.round(perimM * plinthWallWidthM, 2);
    const dpcVolumeM3 = SafeMath.round(dpcAreaM2 * 0.05, 3); // 50mm thickness

    // DPC Concrete materials (Mix 1:2:4 dry factor 1.54)
    const dryVol = dpcVolumeM3 * 1.54;
    const cementBags = SafeMath.round((dryVol / 7) * 28.8, 1);
    const sandVolCft = SafeMath.round((dryVol * 2 / 7) * 35.3147, 1);
    const metal12mmCft = SafeMath.round((dryVol * 4 / 7) * 35.3147, 1);

    // Integral Waterproofing Admixture: 200ml per 50kg bag of cement
    const waterproofingAdmixtureLitres = SafeMath.round(cementBags * 0.20, 2);

    // Bitumen primer / Hot bitumen coat: 1.7 kg per m²
    const bitumenKg = SafeMath.round(dpcAreaM2 * 1.7, 1);

    steps.push(`Damp Proof Course (50mm 1:2:4 DPC): Area = ${dpcAreaM2} m² (${perimM}m linear run)`);
    steps.push(`DPC Materials: Cement = ${cementBags} bags, Sand = ${sandVolCft} cft, 12mm Blue Metal = ${metal12mmCft} cft`);
    steps.push(`Integral Liquid Waterproofing Compound = ${waterproofingAdmixtureLitres} Litres (200ml/bag)`);
    steps.push(`Hot Bitumen 85/25 Sealing Coat = ${bitumenKg} kg (1.7 kg/m²)`);

    return {
      plinthLevelStatus: isFloodSafe ? 'COMPLIANT_POST_MICHAUNG_STANDARD' : 'SUB_STANDARD_FLOOD_RISK',
      plinthHeightMm: proposedPlinthHeightMm,
      minRecommendedHeightMm: minMandatoryPlinthHeightMm,
      areas: { plinthAreaSqft: plinthSqft, plinthAreaM2: plinthM2 },
      fillMaterials: {
        compactedMoorumM3: netFillVolumeM3,
        looseMoorumM3: looseMoorumRequiredM3,
        moorumCft,
        moorumTnUnits,
        sandCushionM3,
        sandCft,
        sandTnUnits
      },
      dpc: {
        linearLengthM: perimM,
        surfaceAreaM2: dpcAreaM2,
        thicknessMm: 50,
        cementBags,
        sandCft: sandVolCft,
        blueMetal12mmCft: metal12mmCft,
        waterproofingAdmixtureLitres,
        bitumenSealerKg: bitumenKg
      },
      warnings,
      calculationSteps: steps,
      engineeringNote: 'Mandatory for high water-table zones in Chennai (Velachery, Pallikaranai, Madipakkam, Kolathur) to eliminate rising capillary dampness and saltpeter efflorescence on ground floor plaster.'
    };
  }
}
