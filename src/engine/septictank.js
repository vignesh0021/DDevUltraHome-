/**
 * Residential Septic Tank & Soak Pit Design Engine
 * In accordance with IS 2470 (Part 1 & 2): 1985
 * Tamil Nadu Residential Sanitary Engineering Standard
 */

import { SafeMath, Validator } from './math.js';
import { CONSTANTS } from './concrete.js';

export class SepticTankEngine {
  /**
   * Design septic tank and soak pit according to IS 2470
   * @param {Object} params
   * @param {number} params.users - Number of occupants / users (e.g. 5, 10, 20)
   * @param {number} [params.sewageFlowLpcd=90] - Daily sewage flow per user in Litres (standard 70-100 LPCD)
   * @param {number} [params.detentionHours=24] - Detention period in hours (standard 24 to 48 hrs)
   * @param {number} [params.cleaningIntervalYears=2] - Sludge withdrawal interval in years (standard 1 to 3 yrs)
   * @param {number} [params.freeboardM=0.30] - Top air space freeboard in meters (standard 300mm)
   * @param {number} [params.percolationRateMin=15] - Soil percolation rate in minutes/cm for soak pit
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const uCheck = Validator.positiveNumber('Number of Users', params.users);
    if (!uCheck.valid) throw new Error(uCheck.error);
    const users = uCheck.value;

    const flowLpcd = Number(params.sewageFlowLpcd) || 90;
    const detentionHrs = Number(params.detentionHours) || 24;
    const cleaningYears = Number(params.cleaningIntervalYears) || 2;
    const freeboard = params.freeboardM !== undefined ? Number(params.freeboardM) : 0.30;

    steps.push(`Occupancy: ${users} persons`);
    steps.push(`Sewage flow allowance per person = ${flowLpcd} LPCD (IS 2470 norm: 70–100 LPCD)`);

    // 1. Daily sewage flow
    const dailySewageLitres = users * flowLpcd;
    const flowVolumeM3 = SafeMath.round((dailySewageLitres * detentionHrs) / (24 * 1000), 3);
    assumptions.push(`Detention period = ${detentionHrs} hours`);
    steps.push(`Sewage flow volume during detention = (${users} × ${flowLpcd} × ${detentionHrs}h) / 24h = ${flowVolumeM3} m³ (${Math.round(flowVolumeM3 * 1000)} Litres)`);

    // 2. Sludge storage volume
    // IS 2470 norm: Sludge accumulation = 0.000085 m³/day/capita (approx 30–40 Litres per capita per year)
    const sludgeLitresPerYear = 35;
    const sludgeVolumeLitres = users * sludgeLitresPerYear * cleaningYears;
    const sludgeVolumeM3 = SafeMath.round(sludgeVolumeLitres / 1000, 3);
    assumptions.push(`Sludge accumulation rate = ${sludgeLitresPerYear} Litres / capita / year with ${cleaningYears} years cleaning interval`);
    steps.push(`Sludge storage required = ${users} × ${sludgeLitresPerYear} L/yr × ${cleaningYears} yrs = ${sludgeVolumeLitres} Litres = ${sludgeVolumeM3} m³`);

    // 3. Total effective liquid volume required
    const totalLiquidM3 = SafeMath.round(flowVolumeM3 + sludgeVolumeM3, 3);
    const totalLiquidLitres = Math.round(totalLiquidM3 * 1000);
    steps.push(`Total effective liquid capacity = Flow (${flowVolumeM3} m³) + Sludge (${sludgeVolumeM3} m³) = ${totalLiquidM3} m³ (${totalLiquidLitres.toLocaleString('en-IN')} Litres)`);

    // 4. Tank geometry (L:W ratio 2.5:1, liquid depth 1.4m)
    const liquidDepthM = 1.4;
    const surfaceAreaRequiredM2 = SafeMath.round(totalLiquidM3 / liquidDepthM, 3);
    // Area = 2.5 * W * W = 2.5 W² => W = sqrt(Area / 2.5)
    const widthM = SafeMath.round(Math.sqrt(surfaceAreaRequiredM2 / 2.5), 2);
    const lengthM = SafeMath.round(widthM * 2.5, 2);
    const totalHeightM = SafeMath.round(liquidDepthM + freeboard, 2);

    const actualLiquidVolumeM3 = SafeMath.round(lengthM * widthM * liquidDepthM, 3);
    const actualGrossVolumeM3 = SafeMath.round(lengthM * widthM * totalHeightM, 3);
    assumptions.push(`Proportion ratio Length:Width = 2.5:1, liquid depth = ${liquidDepthM}m, freeboard = ${freeboard * 1000}mm`);
    steps.push(`Recommended tank internal dimensions: Length = ${lengthM}m, Width = ${widthM}m, Total Depth = ${totalHeightM}m (Liquid depth = ${liquidDepthM}m)`);
    steps.push(`Actual internal storage volume = ${actualGrossVolumeM3} m³ (${Math.round(actualLiquidVolumeM3 * 1000).toLocaleString('en-IN')} Litres effective)`);

    // 5. Soak Pit Sizing per IS 2470 Part 2
    // Maximum allowable percolation rate: standard safe rate 1250 Litres/m²/day
    const percolationRate = Number(params.percolationRateMin) || 15;
    // Allowable hydraulic loading rate (q = 130 / sqrt(percolation rate in min))
    const safeRateLitrePerM2Day = SafeMath.round(130 / Math.sqrt(percolationRate), 1);
    const requiredDispersionAreaM2 = SafeMath.round(dailySewageLitres / safeRateLitrePerM2Day, 2);

    // Soak pit diameter typically 1.2m to 1.5m
    const pitDiaM = 1.5;
    // Dispersion area = π * D * Depth => Depth = Area / (π * D)
    const pitDepthM = SafeMath.round(requiredDispersionAreaM2 / (Math.PI * pitDiaM), 2);
    const recommendedPitDepthM = Math.max(1.8, pitDepthM);

    assumptions.push(`Soil percolation rate = ${percolationRate} min/cm => Safe hydraulic loading = ${safeRateLitrePerM2Day} L/m²/day`);
    steps.push(`Soak Pit: Required side dispersion area = ${dailySewageLitres} L / ${safeRateLitrePerM2Day} L/m²/day = ${requiredDispersionAreaM2} m²`);
    steps.push(`Soak Pit geometry: Diameter = ${pitDiaM}m, Effective Depth = ${recommendedPitDepthM}m (filled with brickbats and 40mm metal)`);

    return {
      occupancy: users,
      dailySewageLitres,
      liquidCapacityLitres: totalLiquidLitres,
      dimensions: {
        lengthM,
        widthM,
        liquidDepthM,
        freeboardM: freeboard,
        totalDepthM: totalHeightM,
        grossVolumeM3: actualGrossVolumeM3,
        liquidVolumeM3: actualLiquidVolumeM3
      },
      soakPit: {
        diameterM: pitDiaM,
        depthM: recommendedPitDepthM,
        sideAreaM2: requiredDispersionAreaM2,
        percolationRateMin: percolationRate
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Septic tanks provide anaerobic preliminary treatment. Effluent must not be discharged directly into open drains; dispersion via soak pit or sub-surface irrigation is mandatory per IS 2470.'
    };
  }
}
