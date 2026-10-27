/**
 * Water Tank Capacity & Domestic Demand Estimation Engine
 * Compliant with IS 1172:1993 (Water Supply in Buildings) and IS 3370 (Concrete Water Tanks)
 */

import { SafeMath, UnitConverter, Validator } from './math.js';
import { CONSTANTS } from './concrete.js';

export const LITRES_PER_M3 = 1000;
export const LITRES_PER_CFT = 28.3168;

export class WaterTankEngine {
  /**
   * Calculate tank volume and effective water capacity
   * @param {Object} params
   * @param {string} [params.shape='RECTANGULAR'] - 'RECTANGULAR' or 'CYLINDRICAL'
   * @param {number} [params.lengthM] - For rectangular (length in meters)
   * @param {number} [params.widthM] - For rectangular (width in meters)
   * @param {number} [params.diameterM] - For cylindrical (internal diameter in meters)
   * @param {number} params.heightM - Total internal height/depth in meters
   * @param {number} [params.freeboardM=0.20] - Top freeboard / air gap in meters (standard 150mm to 300mm)
   */
  static calculateCapacity(params) {
    const steps = [];
    const assumptions = [];

    const shape = (params.shape || 'RECTANGULAR').toUpperCase();
    const hCheck = Validator.positiveNumber('Tank Height/Depth', params.heightM);
    if (!hCheck.valid) throw new Error(hCheck.error);
    const totalHeight = hCheck.value;

    const freeboard = Number(params.freeboardM) !== undefined ? Number(params.freeboardM) : 0.20;
    if (freeboard >= totalHeight) {
      throw new Error('Freeboard cannot be equal to or greater than the tank height.');
    }
    const effectiveWaterDepth = SafeMath.round(totalHeight - freeboard, 3);
    assumptions.push(`Air gap freeboard = ${freeboard * 1000}mm => Effective water depth = ${effectiveWaterDepth}m`);

    let grossVolumeM3 = 0;
    let netWaterVolumeM3 = 0;

    if (shape === 'CYLINDRICAL') {
      const dCheck = Validator.positiveNumber('Internal Diameter', params.diameterM);
      if (!dCheck.valid) throw new Error(dCheck.error);
      const dia = dCheck.value;
      const area = (Math.PI * dia * dia) / 4;

      grossVolumeM3 = SafeMath.round(area * totalHeight, 4);
      netWaterVolumeM3 = SafeMath.round(area * effectiveWaterDepth, 4);

      steps.push(`Cylindrical tank: Internal diameter = ${dia}m, Cross section area = ${SafeMath.round(area, 3)} m²`);
      steps.push(`Gross storage volume = ${SafeMath.round(area, 3)} m² × ${totalHeight}m = ${grossVolumeM3} m³`);
    } else {
      const lCheck = Validator.positiveNumber('Tank Length', params.lengthM);
      const wCheck = Validator.positiveNumber('Tank Width', params.widthM);
      if (!lCheck.valid) throw new Error(lCheck.error);
      if (!wCheck.valid) throw new Error(wCheck.error);

      const l = lCheck.value;
      const w = wCheck.value;

      grossVolumeM3 = SafeMath.round(l * w * totalHeight, 4);
      netWaterVolumeM3 = SafeMath.round(l * w * effectiveWaterDepth, 4);

      steps.push(`Rectangular tank: ${l}m (L) × ${w}m (W) × ${totalHeight}m (H)`);
      steps.push(`Gross internal volume = ${grossVolumeM3} m³ (${SafeMath.round(grossVolumeM3 * CONSTANTS.CFT_PER_M3, 1)} cft)`);
    }

    const netCapacityLitres = Math.round(netWaterVolumeM3 * LITRES_PER_M3);
    const grossCapacityLitres = Math.round(grossVolumeM3 * LITRES_PER_M3);

    steps.push(`Effective Water Capacity = ${netWaterVolumeM3} m³ × 1000 L/m³ = ${netCapacityLitres.toLocaleString('en-IN')} Litres`);

    return {
      tankShape: shape,
      grossVolumeM3,
      grossCapacityLitres,
      effectiveDepthM: effectiveWaterDepth,
      netWaterVolumeM3,
      netCapacityLitres,
      netCapacityGallons: SafeMath.round(netCapacityLitres * 0.219969, 1),
      netCapacityCft: SafeMath.round(netWaterVolumeM3 * CONSTANTS.CFT_PER_M3, 2),
      assumptions,
      calculationSteps: steps,
      disclaimer: 'For underground sumps, ensure waterproof plastering with integral waterproofing compound (e.g. Dr. Fixit LW+) and sump cover.'
    };
  }

  /**
   * Domestic water requirement sizing based on IS 1172
   * @param {Object} params
   * @param {number} params.numberOfOccupants - Number of residents (e.g. 5)
   * @param {number} [params.lpcd=135] - Litres per capita per day (standard residential with full flushing is 135 LPCD)
   * @param {number} [params.storageDays=2] - Days of water reserve (e.g. 2 days)
   */
  static estimateDemandAndSize(params) {
    const occCheck = Validator.positiveNumber('Number of Occupants', params.numberOfOccupants);
    if (!occCheck.valid) throw new Error(occCheck.error);
    const occupants = occCheck.value;

    const lpcd = Number(params.lpcd) || 135;
    const days = Number(params.storageDays) || 2;

    const dailyDemandLitres = occupants * lpcd;
    const totalStorageLitres = dailyDemandLitres * days;

    // Standard TN distribution: 60% in Underground Sump, 40% in Overhead Tank (OHT)
    const sumpLitres = Math.round(totalStorageLitres * 0.60);
    const ohtLitres = Math.round(totalStorageLitres * 0.40);

    return {
      occupants,
      normLpcd: lpcd,
      storageReserveDays: days,
      dailyDemandLitres,
      totalStorageLitres,
      recommendedAllocation: {
        undergroundSumpLitres: sumpLitres,
        overheadTankLitres: ohtLitres
      },
      standardReference: 'IS 1172:1993 - Code of basic requirements for water supply, drainage and sanitation.'
    };
  }
}
