/**
 * Rainwater Harvesting (RWH) Sizing Engine
 * In accordance with TNCDBR 2019 Rule 42 and CMWSSB / GCC Technical Standards
 * Mandatory for all Building Approvals, Completion Certificates & Water Connections in Tamil Nadu
 */

import { SafeMath, Validator } from './math.js';

export const CHENNAI_ANNUAL_RAINFALL_MM = 1350; // Average annual rainfall in Chennai
export const CHENNAI_PEAK_STORM_INTENSITY_MM_PER_HR = 50; // 50mm/hr design storm intensity

export const RUNOFF_COEFFICIENTS = {
  ROOF_RCC: 0.85,          // Concrete flat roof slab
  ROOF_TILED: 0.80,        // Sloped Mangalore / clay tiles
  PAVED_PAVER_BLOCKS: 0.60,// Interlocking paver blocks
  UNPAVED_SOIL: 0.20       // Open garden / lawn / bare earth
};

export class RwhEngine {
  /**
   * Calculate Rainwater Harvesting Potential, Percolation Pit & Recharge Borewell Specifications
   * @param {Object} params
   * @param {number} params.roofAreaSqft - Rooftop catchment area in sq.ft
   * @param {number} [params.pavedAreaSqft=0] - Ground paved driveway / courtyard area in sq.ft
   * @param {string} [params.soilPercolation='MODERATE'] - 'HIGH' (Coastal sand ECR/Besant Nagar), 'MODERATE' (Loam), 'LOW' (Stiff clay Velachery/Tambaram)
   * @param {boolean} [params.includeStorageSump=true] - Whether storage for reuse is required
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const rCheck = Validator.positiveNumber('Roof Area', params.roofAreaSqft);
    if (!rCheck.valid) throw new Error(rCheck.error);
    const roofSqft = rCheck.value;
    const roofM2 = SafeMath.round(roofSqft / 10.7639, 2);

    const pavedSqft = Number(params.pavedAreaSqft !== undefined ? params.pavedAreaSqft : params.openPlotAreaSqft) || 0;
    const pavedM2 = SafeMath.round(pavedSqft / 10.7639, 2);

    const soilPerc = (params.soilPercolation || 'MODERATE').toUpperCase();

    steps.push(`Catchment Dimensions: Roof Area = ${roofSqft} sq.ft (${roofM2} m²), Paved Ground = ${pavedSqft} sq.ft (${pavedM2} m²)`);
    steps.push(`Chennai Annual Average Rainfall = ${CHENNAI_ANNUAL_RAINFALL_MM} mm (${CHENNAI_ANNUAL_RAINFALL_MM / 1000} m)`);

    // 1. Annual Harvestable Water Potential (Litres/year)
    // Formula: Volume = Area (m²) * Rainfall (m) * Runoff Coefficient * 1000 L/m³
    const cRoof = RUNOFF_COEFFICIENTS.ROOF_RCC;
    const cPaved = RUNOFF_COEFFICIENTS.PAVED_PAVER_BLOCKS;

    const annualRoofLitres = SafeMath.round(roofM2 * (CHENNAI_ANNUAL_RAINFALL_MM / 1000) * cRoof * 1000, 0);
    const annualPavedLitres = SafeMath.round(pavedM2 * (CHENNAI_ANNUAL_RAINFALL_MM / 1000) * cPaved * 1000, 0);
    const totalAnnualHarvestLitres = SafeMath.round(annualRoofLitres + annualPavedLitres, 0);

    steps.push(`Annual Harvestable Volume: Roof (${cRoof * 100}%) = ${annualRoofLitres.toLocaleString('en-IN')} L, Paved = ${annualPavedLitres.toLocaleString('en-IN')} L => Total = ${totalAnnualHarvestLitres.toLocaleString('en-IN')} Litres/year`);

    // 2. Design Peak Storm Runoff Capacity
    // Designed for 25mm intense single-storm cloudburst
    const stormDesignDepthM = 0.025;
    const peakStormLitres = SafeMath.round((roofM2 * cRoof + pavedM2 * cPaved) * stormDesignDepthM * 1000, 0);
    steps.push(`Single Storm (25mm) Recharge Volume = ${peakStormLitres.toLocaleString('en-IN')} Litres`);

    // 3. First-Flush Separator Sizing
    // Standard rule: Discard first 1.5mm to wash off dust and bird droppings
    const firstFlushLitres = SafeMath.round(roofM2 * 0.0015 * 1000, 0);
    steps.push(`First-Flush Diverter Capacity = ${firstFlushLitres} Litres (removes rooftop particulate matter before filter bed)`);

    // 4. Percolation Pit with Recharge Bore Sizing (TNCDBR Rule 42)
    // Minimum 1 pit per 1000 sq.ft of roof area or fraction thereof (minimum 1 pit)
    const pitsCount = Math.max(1, Math.ceil(roofSqft / 1000));
    
    // Standard CMWSSB Pit: 1.0m dia or 1.0m x 1.0m square, depth 1.5m
    const pitLengthM = 1.0;
    const pitWidthM = 1.0;
    const pitDepthM = 1.5;
    const pitVolumeM3 = SafeMath.round(pitLengthM * pitWidthM * pitDepthM, 2);

    // Recharge Bore inside pit:
    // For clay soils (Velachery/Tambaram), 6-inch (150mm) PVC casing pipe must reach sandy aquifer layer (4.5m to 6.0m depth)
    let boreDepthM = 3.0;
    if (soilPerc === 'LOW') {
      boreDepthM = 6.0;
      assumptions.push('Low percolation stiff clay soil detected: 150mm PVC slotted recharge bore extended to 6.0m depth to tap sand stratum');
    } else if (soilPerc === 'HIGH') {
      boreDepthM = 3.0;
      assumptions.push('High percolation coastal sand soil (ECR/Besant Nagar): 3.0m shallow slotted bore with gravel filter');
    } else {
      boreDepthM = 4.5;
      assumptions.push('Moderate percolation loamy soil: 4.5m recharge bore with 150mm slotted PVC casing');
    }

    // Filter media materials per pit
    const blueMetal40mmM3 = SafeMath.round(pitVolumeM3 * 0.40, 2); // 40% bottom layer
    const gravelCoarseM3 = SafeMath.round(pitVolumeM3 * 0.35, 2);  // 35% middle layer
    const coarseSandM3 = SafeMath.round(pitVolumeM3 * 0.25, 2);    // 25% top layer

    steps.push(`Percolation Pits Required: ${pitsCount} No(s) of size ${pitLengthM}m × ${pitWidthM}m × ${pitDepthM}m with ${boreDepthM}m deep 150mm PVC slotted recharge casing`);

    // 5. Rainwater Filter Bed & Storage Sump (Optional / Recommended for Domestic Reuse)
    // Sump sized to hold 3 to 5 days of domestic flushing/gardening or 40% of peak storm volume
    const recommendedSumpLitres = Math.min(10000, Math.max(3000, Math.round(peakStormLitres * 0.40 / 500) * 500));

    return {
      annualPotentialLitres: totalAnnualHarvestLitres,
      annualRainfallYieldLitres: totalAnnualHarvestLitres,
      roofAreaSqft: roofSqft,
      recommendedWellDiameterM: 1.0,
      recommendedWellDepthM: boreDepthM,
      annualRoofLitres,
      annualPavedLitres,
      peakStormLitres,
      firstFlushLitres,
      percolationSystem: {
        numberOfPits: pitsCount,
        pitDimensions: { lengthM: pitLengthM, widthM: pitWidthM, depthM: pitDepthM, volumeM3: pitVolumeM3 },
        rechargeBore: { diameterMm: 150, depthM: boreDepthM, casingType: '150mm Class-3 Slotted PVC Casing Pipe' },
        filterMediaPerPit: {
          blueMetal40mmM3,
          gravelCoarseM3,
          coarseSandM3
        }
      },
      recommendedStorageSumpLitres: recommendedSumpLitres,
      complianceStatus: 'COMPLIANT_TNCDBR_RULE_42',
      statutoryNote: 'Mandatory under TNCDBR 2019 Rule 42. Required for CMDA / GCC Building Completion Certificate (CC) and CMWSSB connection.',
      assumptions,
      calculationSteps: steps
    };
  }
}
