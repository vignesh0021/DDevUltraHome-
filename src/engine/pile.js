/**
 * Short Bored & Under-Reamed Pile Foundation Sizing Engine
 * In accordance with IS 2911 (Part 3): 1980 / Reaffirmed 2010
 * Specifically designed for soft clay & expansive black cotton soils in Chennai (Velachery, Pallikaranai, Madipakkam, OMR)
 */

import { SafeMath, Validator } from './math.js';

export class PileEngine {
  /**
   * Sizing and Safe Load Capacity of Under-Reamed Cast-in-situ RCC Pile
   * @param {Object} params
   * @param {number} params.columnLoadKn - Column Axial Service Load in kN (e.g. 500 kN)
   * @param {number} [params.pileDiameterMm=300] - Shaft diameter D in mm (250mm or 300mm standard)
   * @param {number} [params.pileLengthM=4.0] - Embedded depth of pile in meters (typically 3.5m to 5.0m)
   * @param {number} [params.cohesionCpkN=60] - Undrained soil shear cohesion c in kN/m² (e.g. 40-80 kN/m² for Chennai clay)
   * @param {number} [params.numberOfBulbs=1] - 1 for single under-reamed, 2 for double under-reamed
   * @param {string} [params.concreteGrade='M25'] - Concrete mix grade
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const loadCheck = Validator.positiveNumber('Column Load', params.columnLoadKn);
    if (!loadCheck.valid) throw new Error(loadCheck.error);
    const pServiceKn = loadCheck.value;

    const dShaftMm = Number(params.pileDiameterMm) || 300;
    const dShaftM = dShaftMm / 1000;
    const depthM = Number(params.pileLengthM) || 4.0;
    const cuKnM2 = Number(params.cohesionCpkN) || 60; // Cohesion in kN/m²
    const bulbsCount = Number(params.numberOfBulbs) === 2 ? 2 : 1;

    // 1. Geometry of Under-Reamed Pile per IS 2911 Part 3
    // Bulb diameter Du = 2.5 * Shaft diameter D
    const dBulbM = SafeMath.round(dShaftM * 2.5, 2);
    const dBulbMm = Math.round(dBulbM * 1000);

    const aShaftM2 = SafeMath.round((Math.PI * dShaftM * dShaftM) / 4, 4);
    const aBulbM2 = SafeMath.round((Math.PI * dBulbM * dBulbM) / 4, 4);
    const aAnnularM2 = SafeMath.round(aBulbM2 - aShaftM2, 4);

    steps.push(`Pile Geometry: Shaft Dia D = ${dShaftMm}mm, Bulb Dia Du = ${dBulbMm}mm (2.5D), Embedment Length L = ${depthM}m`);
    steps.push(`Soil Parameters: Undrained Cohesion cu = ${cuKnM2} kN/m² (Typical Chennai alluvial/marine clay)`);

    // 2. Ultimate Capacity Calculation in Cohesive Soil (IS 2911 Part 3 Clause 5.2.1)
    // Qu = Ap * Nc * cp + Aa * Nc * ca + alpha * ca' * As
    const nc = 9.0; // Bearing capacity factor for deep foundation in clay
    const alpha = 0.50; // Adhesion factor for stiff to medium clay

    // (a) End Bearing on Bulb Base:
    const qEndBearingKn = SafeMath.round(aBulbM2 * nc * cuKnM2, 1);
    steps.push(`1. End Bearing of Under-Reamed Bulb Base: ${aBulbM2} m² × 9.0 × ${cuKnM2} kN/m² = ${qEndBearingKn} kN`);

    // (b) Annular Ring Bearing (for top of bulb or multi-bulbs):
    let qAnnularBearingKn = 0;
    if (bulbsCount === 2) {
      qAnnularBearingKn = SafeMath.round(aAnnularM2 * nc * cuKnM2, 1);
      steps.push(`2. Additional Annular Bearing for 2nd Bulb = ${qAnnularBearingKn} kN`);
    }

    // (c) Shaft Skin Friction (excluding top 1.5m active zone subject to seasonal drying/cracking)
    const effectiveShaftLengthM = Math.max(1.0, depthM - 1.5 - (bulbsCount * 0.75));
    const surfaceAreaShaftM2 = SafeMath.round(Math.PI * dShaftM * effectiveShaftLengthM, 3);
    const qSkinFrictionKn = SafeMath.round(alpha * cuKnM2 * surfaceAreaShaftM2, 1);
    assumptions.push('Top 1.5m shaft friction neglected due to seasonal expansive soil desiccation/shrinkage (IS 2911 Cl 5.2.1.2)');
    steps.push(`3. Shaft Skin Friction (Effective ${effectiveShaftLengthM}m length): 0.50 × ${cuKnM2} × ${surfaceAreaShaftM2} m² = ${qSkinFrictionKn} kN`);

    // Total Ultimate Capacity Qu
    const qUltimateKn = SafeMath.round(qEndBearingKn + qAnnularBearingKn + qSkinFrictionKn, 1);

    // Safe Working Load Capacity with Factor of Safety = 2.5
    const fos = 2.5;
    const qSafeKn = SafeMath.round(qUltimateKn / fos, 1);
    steps.push(`Ultimate Pile Capacity Qu = ${qUltimateKn} kN => Safe Working Load (FOS 2.5) = ${qSafeKn} kN`);

    // 3. Number of Piles Required to Carry Column Axial Load
    const pilesNeeded = Math.max(1, Math.ceil(pServiceKn / qSafeKn));
    const totalGroupCapacityKn = SafeMath.round(pilesNeeded * qSafeKn, 1);
    steps.push(`Column Load = ${pServiceKn} kN => Number of Under-Reamed Piles Required = ${pilesNeeded} No(s) (Total Safe Group Capacity = ${totalGroupCapacityKn} kN)`);

    // 4. Concrete & Reinforcement Take-Off per Pile
    // Shaft volume + Bulb volume (approx bulb as two truncated cones)
    const shaftVolM3 = aShaftM2 * (depthM - 0.75 * bulbsCount);
    const bulbVolM3 = (Math.PI / 12) * 0.75 * (dBulbM * dBulbM + dShaftM * dShaftM + dBulbM * dShaftM) * bulbsCount;
    const concreteVolumePerPileM3 = SafeMath.round(shaftVolM3 + bulbVolM3, 3);

    // Longitudinal Reinforcement: Minimum 0.4% of shaft area (min 6 Nos of 12mm bars)
    const minBars = 6;
    const barDiaMm = 12;
    const rebarWeightKgPerPile = SafeMath.round(minBars * (depthM + 0.5) * (12 * 12 / 162.28), 1); // 0.5m development into pile cap

    // Helical ties: 8mm @ 150mm pitch
    const ringsCount = Math.ceil(depthM / 0.15);
    const ringPerimM = Math.PI * (dShaftM - 0.10); // 50mm cover
    const tiesWeightKgPerPile = SafeMath.round(ringsCount * ringPerimM * (8 * 8 / 162.28), 1);
    const totalSteelKgPerPile = SafeMath.round(rebarWeightKgPerPile + tiesWeightKgPerPile, 1);

    return {
      serviceLoadKn: pServiceKn,
      pileDimensions: {
        shaftDiameterMm: dShaftMm,
        bulbDiameterMm: dBulbMm,
        depthM,
        numberOfBulbs: bulbsCount
      },
      capacity: {
        ultimateCapacityKn: qUltimateKn,
        factorOfSafety: fos,
        safeWorkingCapacityKn: qSafeKn
      },
      pileGroup: {
        pilesRequiredCount: pilesNeeded,
        totalGroupSafeCapacityKn: totalGroupCapacityKn,
        pileCapType: pilesNeeded === 1 ? 'Single Pile Cap' : (pilesNeeded === 2 ? '2-Pile Cap Beam' : `${pilesNeeded}-Pile Triangular/Square Cap`)
      },
      materialPerPile: {
        concreteVolumeM3: concreteVolumePerPileM3,
        mainRebar: `${minBars} Nos of ${barDiaMm}mm TMT`,
        lateralTies: `8mm rings @ 150mm c/c`,
        steelWeightKg: totalSteelKgPerPile
      },
      assumptions,
      calculationSteps: steps,
      standardReference: 'IS 2911 (Part 3): 1980 - Code of practice for design and construction of under-reamed pile foundations'
    };
  }
}
