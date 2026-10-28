/**
 * Earthwork & Backfilling Calculation Engine
 * Compliant with IS 1200 Part 1 and Tamil Nadu PWD Earthwork Norms
 */

import { SafeMath, UnitConverter, Validator } from './math.js';
import { CONSTANTS } from './concrete.js';

export class EarthworkEngine {
  /**
   * Earthwork excavation and backfill estimation
   * @param {Object} params
   * @param {string} [params.type='PIT'] - 'PIT' (column footings), 'TRENCH' (foundation beam/compound wall), 'RAFT' (mass basement)
   * @param {number} params.length - Excavation length in meters
   * @param {number} params.width - Excavation width in meters
   * @param {number} params.depth - Excavation depth in meters
   * @param {number} [params.count=1] - Number of identical pits/trenches
   * @param {number} [params.bulkingFactor=1.25] - Soil swell factor when excavated (typically 1.20 to 1.30)
   * @param {number} [params.compactionFactor=1.18] - Loose soil needed per compacted unit volume
   * @param {number} [params.structureVolumeM3=0] - Concrete/masonry volume occupied in the pit (to be subtracted for backfill)
   * @param {number} [params.plinthFillingVolumeM3=0] - Basement/plinth filling volume
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const lCheck = Validator.positiveNumber('Excavation Length', params.length);
    const wCheck = Validator.positiveNumber('Excavation Width', params.width);
    const dCheck = Validator.positiveNumber('Excavation Depth', params.depth);
    const countCheck = Validator.positiveNumber('Excavation Count', params.count || 1);
    if (!lCheck.valid) throw new Error(lCheck.error);
    if (!wCheck.valid) throw new Error(wCheck.error);
    if (!dCheck.valid) throw new Error(dCheck.error);

    const count = countCheck.value;
    const lM = lCheck.value;
    const wM = wCheck.value;
    const dM = dCheck.value;

    const singleBankVolume = SafeMath.round(lM * wM * dM, 3);
    const totalBankVolume = SafeMath.round(singleBankVolume * count, 3);
    const totalBankCft = SafeMath.round(totalBankVolume * CONSTANTS.CFT_PER_M3, 2);
    const totalBankUnits = SafeMath.round(totalBankCft / CONSTANTS.CFT_PER_TN_UNIT, 3);

    steps.push(`Single pit/trench in-situ volume = ${lM}m × ${wM}m × ${dM}m = ${singleBankVolume} m³`);
    if (count > 1) {
      steps.push(`Total excavation for ${count} pits = ${totalBankVolume} m³ (${totalBankCft} cft / ${totalBankUnits} TN Units)`);
    }

    // Swell / Bulking factor for carting away
    const swell = Number(params.bulkingFactor) || 1.25;
    const looseExcavatedVolume = SafeMath.round(totalBankVolume * swell, 3);
    assumptions.push(`Soil bulking factor = ${swell} (soil swells when loosened)`);
    steps.push(`Loose soil volume after digging = ${totalBankVolume} m³ × ${swell} = ${looseExcavatedVolume} m³`);

    // Backfilling estimation
    const structVol = Number(params.structureVolumeM3) || 0;
    const pitBackfillCompacted = Math.max(0, SafeMath.round(totalBankVolume - structVol, 3));
    const plinthVol = Number(params.plinthFillingVolumeM3) || 0;
    const totalCompactedBackfill = SafeMath.round(pitBackfillCompacted + plinthVol, 3);

    const compactor = Number(params.compactionFactor) || 1.18;
    const looseSoilNeededForBackfill = SafeMath.round(totalCompactedBackfill * compactor, 3);
    assumptions.push(`Compaction shrinkage factor = ${compactor} (loose to compacted ratio)`);

    steps.push(`Structure volume in pit = ${structVol} m³ => Net pit backfill volume = ${pitBackfillCompacted} m³`);
    if (plinthVol > 0) {
      steps.push(`Plinth/basement filling required = ${plinthVol} m³`);
      steps.push(`Total compacted backfill = ${totalCompactedBackfill} m³ (requires ${looseSoilNeededForBackfill} m³ loose earth)`);
    }

    // Surplus soil to be carted away
    // Surplus = Loose excavated soil - Loose soil used for backfill
    const surplusSoilLoose = Math.max(0, SafeMath.round(looseExcavatedVolume - looseSoilNeededForBackfill, 3));
    const deficitSoilRequired = looseSoilNeededForBackfill > looseExcavatedVolume 
      ? SafeMath.round(looseSoilNeededForBackfill - looseExcavatedVolume, 3) 
      : 0;

    if (surplusSoilLoose > 0) {
      steps.push(`Surplus soil to cart away / dispose off-site = ${surplusSoilLoose} m³ (${SafeMath.round(surplusSoilLoose * CONSTANTS.CFT_PER_M3, 1)} cft)`);
    } else if (deficitSoilRequired > 0) {
      steps.push(`Deficit soil to import for plinth filling = ${deficitSoilRequired} m³ (${SafeMath.round(deficitSoilRequired * CONSTANTS.CFT_PER_TN_UNIT, 2)} TN Units gravel/soil)`);
    }

    return {
      workType: 'Earthwork Excavation & Backfilling',
      dimensions: { lengthM: lM, widthM: wM, depthM: dM, count },
      inSituExcavationM3: totalBankVolume,
      inSituExcavationCft: totalBankCft,
      inSituExcavationTnUnits: totalBankUnits,
      looseExcavatedM3: looseExcavatedVolume,
      backfill: {
        pitBackfillM3: pitBackfillCompacted,
        plinthFillingM3: plinthVol,
        totalCompactedM3: totalCompactedBackfill,
        looseSoilRequiredM3: looseSoilNeededForBackfill
      },
      surplusDisposalM3: surplusSoilLoose,
      deficitImportM3: deficitSoilRequired,
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Soil bearing classification (ordinary soil, hard gravel, soft rock, hard rock) affects blasting/pneumatic equipment and labor output rates.'
    };
  }
}
