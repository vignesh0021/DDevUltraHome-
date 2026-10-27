/**
 * RCC Structural Elements Quantity Module
 * Covers Slabs, Beams, Columns, Isolated Footings, and Staircases
 * Compliant with IS 456:2000, IS 1200, and TN Civil Practices
 */

import { SafeMath, UnitConverter, Validator } from './math.js';
import { ConcreteEngine, CONSTANTS } from './concrete.js';

export const STEEL_DENSITY_KG_M3 = 7850; // Standard density of structural steel

export class RccEngine {
  /**
   * RCC Slab Quantity Estimation
   * @param {Object} params
   * @param {number} params.length - Length of slab in meters (or specified unit)
   * @param {number} params.width - Width of slab in meters
   * @param {number} params.thickness - Thickness of slab in mm (e.g., 125mm, 150mm) or meters
   * @param {string} [params.dimensionUnit='m']
   * @param {string} [params.thicknessUnit='mm']
   * @param {string} [params.mixGrade='M20']
   * @param {number} [params.steelPercentage=0.8] - Steel % of gross concrete volume (Standard IS slab: 0.7% - 1.0%)
   * @param {number} [params.coverMm=20] - Clear cover in mm
   */
  static calculateSlab(params) {
    const steps = [];
    const assumptions = [];

    const lCheck = Validator.positiveNumber('Slab Length', params.length);
    const wCheck = Validator.positiveNumber('Slab Width', params.width);
    const tCheck = Validator.positiveNumber('Slab Thickness', params.thickness);
    if (!lCheck.valid) throw new Error(lCheck.error);
    if (!wCheck.valid) throw new Error(wCheck.error);
    if (!tCheck.valid) throw new Error(tCheck.error);

    let lM = params.dimensionUnit && params.dimensionUnit !== 'm' 
      ? UnitConverter.convertLength(lCheck.value, params.dimensionUnit, 'm') 
      : lCheck.value;
    let wM = params.dimensionUnit && params.dimensionUnit !== 'm' 
      ? UnitConverter.convertLength(wCheck.value, params.dimensionUnit, 'm') 
      : wCheck.value;
    let tM = params.thicknessUnit === 'mm' 
      ? tCheck.value / 1000 
      : (params.thicknessUnit === 'inch' ? tCheck.value * 0.0254 : tCheck.value);

    // Slab span ratio (Ly / Lx) to check one-way vs two-way slab
    const longSpan = Math.max(lM, wM);
    const shortSpan = Math.min(lM, wM);
    const aspect = SafeMath.round(longSpan / shortSpan, 2);
    const slabType = aspect > 2 ? 'One-Way Slab (Ly/Lx > 2)' : 'Two-Way Slab (Ly/Lx <= 2)';
    steps.push(`Span analysis: Ly=${longSpan}m, Lx=${shortSpan}m, Ratio=${aspect} => ${slabType}`);

    // Concrete volume
    const concreteVolume = SafeMath.round(lM * wM * tM, 4);
    steps.push(`Concrete wet volume = ${lM}m × ${wM}m × ${tM}m = ${concreteVolume} m³ (${SafeMath.round(concreteVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);

    // Shuttering area (bottom soffit + side edges)
    const bottomArea = SafeMath.round(lM * wM, 2);
    const sideArea = SafeMath.round(2 * (lM + wM) * tM, 2);
    const totalShutteringArea = SafeMath.round(bottomArea + sideArea, 2);
    steps.push(`Shuttering contact area = Bottom (${bottomArea} m²) + Perimeter edges (${sideArea} m²) = ${totalShutteringArea} m² (${SafeMath.round(totalShutteringArea * 10.7639, 2)} sq.ft)`);

    // Steel calculation based on volume percentage or standard norms
    const steelPct = Number(params.steelPercentage) || 0.8;
    assumptions.push(`Steel reinforcement estimated at ${steelPct}% of concrete volume (IS 456 standard residential slab design: 0.7%–1.0%)`);
    const steelVolume = concreteVolume * (steelPct / 100);
    const steelWeightKg = SafeMath.round(steelVolume * STEEL_DENSITY_KG_M3, 2);
    const steelTonnes = SafeMath.round(steelWeightKg / 1000, 3);
    steps.push(`Steel weight = ${concreteVolume} m³ × ${steelPct}% × 7850 kg/m³ = ${steelWeightKg} kg (${steelTonnes} MT)`);

    // Detailed concrete constituents
    const concreteDetails = ConcreteEngine.calculate({
      volumeM3: concreteVolume,
      mixGrade: params.mixGrade || 'M20',
      wastagePercent: params.wastagePercent || 2
    });

    return {
      element: 'RCC Slab',
      slabType,
      aspectRatio: aspect,
      dimensions: { lengthM: lM, widthM: wM, thicknessM: tM, thicknessMm: tCheck.value },
      concreteVolumeM3: concreteVolume,
      concreteVolumeCft: SafeMath.round(concreteVolume * CONSTANTS.CFT_PER_M3, 2),
      shutteringAreaM2: totalShutteringArea,
      shutteringAreaSqft: SafeMath.round(totalShutteringArea * 10.7639, 2),
      steel: {
        percentage: steelPct,
        weightKg: steelWeightKg,
        weightTonnes: steelTonnes,
        unit: 'kg'
      },
      concreteMaterials: concreteDetails.materials,
      mixGrade: concreteDetails.mixGrade,
      assumptions: [...assumptions, ...concreteDetails.assumptions],
      calculationSteps: [...steps, ...concreteDetails.calculationSteps],
      disclaimer: 'Steel estimate based on standard rule-of-thumb percentage for BOQ. Bar Bending Schedule (BBS) should be followed for site fabrication.'
    };
  }

  /**
   * RCC Beam Quantity Estimation
   * @param {Object} params
   * @param {number} params.span - Clear or effective span of beam in meters
   * @param {number} params.width - Beam width in mm (e.g. 230mm or 300mm) or meters
   * @param {number} params.depth - Beam total depth in mm (e.g. 380mm, 450mm, 600mm) or meters
   * @param {number} [params.count=1] - Number of identical beams
   * @param {string} [params.dimensionUnit='mm'] - Unit for width & depth
   * @param {string} [params.mixGrade='M20']
   * @param {number} [params.steelPercentage=1.5] - Beam steel % (IS 456 standard: 1.0% - 2.0%)
   */
  static calculateBeam(params) {
    const steps = [];
    const assumptions = [];

    const spanCheck = Validator.positiveNumber('Beam Span', params.span);
    const wCheck = Validator.positiveNumber('Beam Width', params.width);
    const dCheck = Validator.positiveNumber('Beam Depth', params.depth);
    const countCheck = Validator.positiveNumber('Beam Count', params.count || 1);
    if (!spanCheck.valid) throw new Error(spanCheck.error);
    if (!wCheck.valid) throw new Error(wCheck.error);
    if (!dCheck.valid) throw new Error(dCheck.error);

    const count = countCheck.value;
    const spanM = params.dimensionUnit === 'm' ? spanCheck.value : spanCheck.value; // Span is in meters
    const wM = params.dimensionUnit === 'm' ? wCheck.value : wCheck.value / 1000;
    const dM = params.dimensionUnit === 'm' ? dCheck.value : dCheck.value / 1000;

    // Concrete volume
    const singleVolumeRaw = spanM * wM * dM;
    const singleVolume = SafeMath.round(singleVolumeRaw, 4);
    const totalVolume = SafeMath.round(singleVolumeRaw * count, 4);
    steps.push(`Single beam concrete volume = ${spanM}m × ${wM}m × ${dM}m = ${singleVolume} m³`);
    if (count > 1) {
      steps.push(`Total concrete volume for ${count} beams = ${totalVolume} m³ (${SafeMath.round(totalVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);
    }

    // Shuttering area: Bottom soffit + 2 sides (excluding slab depth if monolithic, here calculated for full beam depth)
    const singleShuttering = SafeMath.round((wM + 2 * dM) * spanM, 3);
    const totalShuttering = SafeMath.round(singleShuttering * count, 2);
    steps.push(`Beam shuttering area = (Bottom: ${wM}m + 2 Sides: ${2 * dM}m) × ${spanM}m = ${singleShuttering} m² per beam (Total: ${totalShuttering} m²)`);

    // Steel calculation
    const steelPct = Number(params.steelPercentage) || 1.5;
    assumptions.push(`Steel reinforcement estimated at ${steelPct}% of concrete volume (IS 456 residential beam standard: 1.0%–2.0%)`);
    const steelVolume = totalVolume * (steelPct / 100);
    const steelWeightKg = SafeMath.round(steelVolume * STEEL_DENSITY_KG_M3, 2);
    const steelTonnes = SafeMath.round(steelWeightKg / 1000, 3);
    steps.push(`Steel weight = ${totalVolume} m³ × ${steelPct}% × 7850 kg/m³ = ${steelWeightKg} kg (${steelTonnes} MT)`);

    const concreteDetails = ConcreteEngine.calculate({
      volumeM3: totalVolume,
      mixGrade: params.mixGrade || 'M20',
      wastagePercent: params.wastagePercent || 2
    });

    return {
      element: 'RCC Beam',
      count,
      dimensions: { spanM, widthM: wM, depthM: dM },
      concreteVolumeM3: totalVolume,
      concreteVolumeCft: SafeMath.round(totalVolume * CONSTANTS.CFT_PER_M3, 2),
      shutteringAreaM2: totalShuttering,
      shutteringAreaSqft: SafeMath.round(totalShuttering * 10.7639, 2),
      steel: {
        percentage: steelPct,
        weightKg: steelWeightKg,
        weightTonnes: steelTonnes,
        unit: 'kg'
      },
      concreteMaterials: concreteDetails.materials,
      mixGrade: concreteDetails.mixGrade,
      assumptions: [...assumptions, ...concreteDetails.assumptions],
      calculationSteps: [...steps, ...concreteDetails.calculationSteps],
      disclaimer: 'Beam steel estimate is preliminary. Main bars, shear stirrups, and curtailment must strictly follow structural consultant schedules.'
    };
  }

  /**
   * RCC Column Quantity Estimation
   * @param {Object} params
   * @param {number} params.height - Clear height in meters
   * @param {number} params.width - Column width in mm (e.g. 230mm, 300mm)
   * @param {number} params.depth - Column depth in mm (e.g. 300mm, 450mm)
   * @param {number} [params.count=1] - Number of columns
   * @param {string} [params.mixGrade='M20']
   * @param {number} [params.steelPercentage=2.0] - Steel % (IS 456 standard: 1.5% - 3.0%)
   */
  static calculateColumn(params) {
    const steps = [];
    const assumptions = [];

    const hCheck = Validator.positiveNumber('Column Height', params.height);
    const wCheck = Validator.positiveNumber('Column Width', params.width);
    const dCheck = Validator.positiveNumber('Column Depth', params.depth);
    const countCheck = Validator.positiveNumber('Column Count', params.count || 1);
    if (!hCheck.valid) throw new Error(hCheck.error);
    if (!wCheck.valid) throw new Error(wCheck.error);
    if (!dCheck.valid) throw new Error(dCheck.error);

    const count = countCheck.value;
    const hM = hCheck.value;
    const wM = wCheck.value / 1000;
    const dM = dCheck.value / 1000;

    const singleVolume = SafeMath.round(hM * wM * dM, 4);
    const totalVolume = SafeMath.round(singleVolume * count, 4);
    steps.push(`Single column concrete volume = ${hM}m × ${wM}m × ${dM}m = ${singleVolume} m³`);
    if (count > 1) {
      steps.push(`Total concrete volume for ${count} columns = ${totalVolume} m³ (${SafeMath.round(totalVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);
    }

    // Shuttering area: 4 vertical faces
    const perimeter = 2 * (wM + dM);
    const singleShuttering = SafeMath.round(perimeter * hM, 3);
    const totalShuttering = SafeMath.round(singleShuttering * count, 2);
    steps.push(`Column shuttering = 4 faces perimeter (${perimeter}m) × ${hM}m = ${singleShuttering} m² each (Total: ${totalShuttering} m²)`);

    // Steel calculation
    const steelPct = Number(params.steelPercentage) || 2.0;
    assumptions.push(`Steel reinforcement estimated at ${steelPct}% of concrete volume (IS 456 column standard: 1.5%–3.0%)`);
    const steelVolume = totalVolume * (steelPct / 100);
    const steelWeightKg = SafeMath.round(steelVolume * STEEL_DENSITY_KG_M3, 2);
    const steelTonnes = SafeMath.round(steelWeightKg / 1000, 3);
    steps.push(`Steel weight = ${totalVolume} m³ × ${steelPct}% × 7850 kg/m³ = ${steelWeightKg} kg (${steelTonnes} MT)`);

    const concreteDetails = ConcreteEngine.calculate({
      volumeM3: totalVolume,
      mixGrade: params.mixGrade || 'M20',
      wastagePercent: params.wastagePercent || 2
    });

    return {
      element: 'RCC Column',
      count,
      dimensions: { heightM: hM, widthM: wM, depthM: dM },
      concreteVolumeM3: totalVolume,
      concreteVolumeCft: SafeMath.round(totalVolume * CONSTANTS.CFT_PER_M3, 2),
      shutteringAreaM2: totalShuttering,
      shutteringAreaSqft: SafeMath.round(totalShuttering * 10.7639, 2),
      steel: {
        percentage: steelPct,
        weightKg: steelWeightKg,
        weightTonnes: steelTonnes,
        unit: 'kg'
      },
      concreteMaterials: concreteDetails.materials,
      mixGrade: concreteDetails.mixGrade,
      assumptions: [...assumptions, ...concreteDetails.assumptions],
      calculationSteps: [...steps, ...concreteDetails.calculationSteps],
      disclaimer: 'Longitudinal rebar diameter, tie spacing, and lap zones must conform to IS 13920 ductile detailing norms.'
    };
  }

  /**
   * RCC Isolated Footing Quantity Estimation
   * @param {Object} params
   * @param {number} params.length - Footing length in meters (e.g. 1.5m)
   * @param {number} params.width - Footing width in meters (e.g. 1.5m)
   * @param {number} params.depth - Total footing depth in mm (e.g. 450mm) or meters
   * @param {number} [params.pccBedThicknessMm=100] - 1:4:8 PCC bed thickness in mm (e.g. 100mm)
   * @param {number} [params.pccOffsetMm=100] - PCC offset around footing in mm (e.g. 100mm = 4 inches)
   * @param {number} [params.count=1] - Number of footings
   * @param {string} [params.mixGrade='M20']
   * @param {number} [params.steelPercentage=0.8] - Steel % of footing concrete (Standard: 0.6% - 0.9%)
   */
  static calculateFooting(params) {
    const steps = [];
    const assumptions = [];

    const lCheck = Validator.positiveNumber('Footing Length', params.length);
    const wCheck = Validator.positiveNumber('Footing Width', params.width);
    const dCheck = Validator.positiveNumber('Footing Depth', params.depth);
    const countCheck = Validator.positiveNumber('Footing Count', params.count || 1);
    if (!lCheck.valid) throw new Error(lCheck.error);
    if (!wCheck.valid) throw new Error(wCheck.error);
    if (!dCheck.valid) throw new Error(dCheck.error);

    const count = countCheck.value;
    const lM = lCheck.value;
    const wM = wCheck.value;
    const dM = params.depth > 10 ? dCheck.value / 1000 : dCheck.value;

    const singleVolume = SafeMath.round(lM * wM * dM, 4);
    const totalVolume = SafeMath.round(singleVolume * count, 4);
    steps.push(`Single footing concrete volume = ${lM}m × ${wM}m × ${dM}m = ${singleVolume} m³`);
    if (count > 1) {
      steps.push(`Total footing concrete for ${count} units = ${totalVolume} m³ (${SafeMath.round(totalVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);
    }

    // Shuttering area around 4 side vertical perimeter of footing
    const singleShuttering = SafeMath.round(2 * (lM + wM) * dM, 3);
    const totalShuttering = SafeMath.round(singleShuttering * count, 2);
    steps.push(`Footing side shuttering = 2 × (${lM} + ${wM}) × ${dM} = ${singleShuttering} m² each (Total: ${totalShuttering} m²)`);

    // PCC Bed (1:4:8 Lean Concrete under footing)
    const pccThickM = (params.pccBedThicknessMm || 100) / 1000;
    const pccOffsetM = (params.pccOffsetMm || 100) / 1000;
    const pccLength = SafeMath.round(lM + 2 * pccOffsetM, 3);
    const pccWidth = SafeMath.round(wM + 2 * pccOffsetM, 3);
    const singlePccVolume = SafeMath.round(pccLength * pccWidth * pccThickM, 4);
    const totalPccVolume = SafeMath.round(singlePccVolume * count, 4);
    steps.push(`PCC Bed (M7.5 / 1:4:8) with ${pccOffsetM * 1000}mm offset: ${pccLength}m × ${pccWidth}m × ${pccThickM}m = ${singlePccVolume} m³ each (Total: ${totalPccVolume} m³)`);

    // Steel calculation
    const steelPct = Number(params.steelPercentage) || 0.8;
    assumptions.push(`Footing bottom mesh reinforcement estimated at ${steelPct}% of concrete volume`);
    const steelVolume = totalVolume * (steelPct / 100);
    const steelWeightKg = SafeMath.round(steelVolume * STEEL_DENSITY_KG_M3, 2);
    const steelTonnes = SafeMath.round(steelWeightKg / 1000, 3);
    steps.push(`Footing steel mesh = ${totalVolume} m³ × ${steelPct}% × 7850 kg/m³ = ${steelWeightKg} kg`);

    const rccConcrete = ConcreteEngine.calculate({
      volumeM3: totalVolume,
      mixGrade: params.mixGrade || 'M20',
      wastagePercent: 2
    });

    const pccConcrete = ConcreteEngine.calculate({
      volumeM3: totalPccVolume,
      mixGrade: 'M7.5',
      wastagePercent: 2
    });

    return {
      element: 'RCC Isolated Footing',
      count,
      dimensions: { lengthM: lM, widthM: wM, depthM: dM },
      rccVolumeM3: totalVolume,
      pccVolumeM3: totalPccVolume,
      shutteringAreaM2: totalShuttering,
      steel: {
        percentage: steelPct,
        weightKg: steelWeightKg,
        weightTonnes: steelTonnes,
        unit: 'kg'
      },
      rccMaterials: rccConcrete.materials,
      pccMaterials: pccConcrete.materials,
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Assumes uniform pad footing. For trapezoidal sloped footings, adjust sloped upper volume according to design angle.'
    };
  }

  /**
   * RCC Staircase Quantity Estimation
   * @param {Object} params
   * @param {number} params.waistSlabThicknessMm - Waist slab thickness (e.g. 150mm)
   * @param {number} params.stairWidthM - Stair width in meters (e.g. 1.0m or 1.2m)
   * @param {number} params.flightLengthM - Horizontal flight length in meters (e.g. 2.5m)
   * @param {number} params.riserMm - Riser height in mm (e.g. 150mm = 6 inches)
   * @param {number} params.treadMm - Tread depth in mm (e.g. 250mm or 300mm = 10 or 12 inches)
   * @param {number} params.numberOfSteps - Number of steps in flight (e.g. 10)
   * @param {number} [params.landingLengthM=1.0] - Landing slab length in meters
   * @param {string} [params.mixGrade='M20']
   * @param {number} [params.steelPercentage=1.0] - Staircase steel %
   */
  static calculateStaircase(params) {
    const steps = [];
    const assumptions = [];

    const waistMm = Validator.positiveNumber('Waist Slab Thickness', params.waistSlabThicknessMm);
    const widthM = Validator.positiveNumber('Stair Width', params.stairWidthM);
    const riserMm = Validator.positiveNumber('Riser', params.riserMm);
    const treadMm = Validator.positiveNumber('Tread', params.treadMm);
    const numSteps = Validator.positiveNumber('Number of Steps', params.numberOfSteps);
    if (!waistMm.valid) throw new Error(waistMm.error);
    if (!widthM.valid) throw new Error(widthM.error);
    if (!riserMm.valid) throw new Error(riserMm.error);
    if (!treadMm.valid) throw new Error(treadMm.error);
    if (!numSteps.valid) throw new Error(numSteps.error);

    const wThickM = waistMm.value / 1000;
    const bM = widthM.value;
    const rM = riserMm.value / 1000;
    const tM = treadMm.value / 1000;
    const n = numSteps.value;

    // Inclined waist slab length = sqrt(horizontal² + vertical²)
    const totalRiseM = n * rM;
    const totalGoingM = (n - 1) * tM;
    const inclinedLengthM = SafeMath.round(Math.sqrt(Math.pow(totalRiseM, 2) + Math.pow(totalGoingM, 2)), 3);
    steps.push(`Staircase geometry: Total rise = ${totalRiseM}m, Total going = ${totalGoingM}m, Inclined length = ${inclinedLengthM}m`);

    // 1. Waist slab concrete volume
    const waistVolume = SafeMath.round(inclinedLengthM * bM * wThickM, 4);
    steps.push(`Waist slab volume = ${inclinedLengthM}m × ${bM}m × ${wThickM}m = ${waistVolume} m³`);

    // 2. Steps concrete volume (Triangular prisms: 0.5 * Riser * Tread * Width * Number of steps)
    const singleStepVol = SafeMath.round(0.5 * rM * tM * bM, 4);
    const stepsVolume = SafeMath.round(singleStepVol * n, 4);
    steps.push(`Steps triangular volume = (${n} steps) × (0.5 × ${rM}m × ${tM}m × ${bM}m) = ${stepsVolume} m³`);

    // 3. Landing slab concrete volume (if any)
    const landingLenM = Number(params.landingLengthM) || 0;
    const landingVolume = SafeMath.round(landingLenM * bM * wThickM, 4);
    if (landingLenM > 0) {
      steps.push(`Landing slab volume = ${landingLenM}m × ${bM}m × ${wThickM}m = ${landingVolume} m³`);
    }

    const totalConcreteM3 = SafeMath.round(waistVolume + stepsVolume + landingVolume, 4);
    steps.push(`Total staircase concrete volume = ${waistVolume} + ${stepsVolume} + ${landingVolume} = ${totalConcreteM3} m³ (${SafeMath.round(totalConcreteM3 * CONSTANTS.CFT_PER_M3, 2)} cft)`);

    // Shuttering area: Inclined waist slab bottom + side risers + landing bottom
    const waistSoffit = SafeMath.round(inclinedLengthM * bM, 2);
    const riserShuttering = SafeMath.round(n * (rM * bM), 2);
    const landingSoffit = SafeMath.round(landingLenM * bM, 2);
    const sideEdges = SafeMath.round(inclinedLengthM * wThickM * 2, 2);
    const totalShuttering = SafeMath.round(waistSoffit + riserShuttering + landingSoffit + sideEdges, 2);
    steps.push(`Shuttering area: Soffit (${waistSoffit} m²) + Risers (${riserShuttering} m²) + Landing (${landingSoffit} m²) + Edges (${sideEdges} m²) = ${totalShuttering} m²`);

    // Steel calculation
    const steelPct = Number(params.steelPercentage) || 1.0;
    assumptions.push(`Staircase steel estimated at ${steelPct}% of total concrete volume`);
    const steelWeightKg = SafeMath.round(totalConcreteM3 * (steelPct / 100) * STEEL_DENSITY_KG_M3, 2);

    const concreteDetails = ConcreteEngine.calculate({
      volumeM3: totalConcreteM3,
      mixGrade: params.mixGrade || 'M20',
      wastagePercent: 2
    });

    return {
      element: 'RCC Staircase Flight',
      geometry: { totalRiseM, totalGoingM, inclinedLengthM, numberOfSteps: n },
      concreteVolumeM3: totalConcreteM3,
      concreteVolumeCft: SafeMath.round(totalConcreteM3 * CONSTANTS.CFT_PER_M3, 2),
      shutteringAreaM2: totalShuttering,
      steel: {
        percentage: steelPct,
        weightKg: steelWeightKg,
        weightTonnes: SafeMath.round(steelWeightKg / 1000, 3),
        unit: 'kg'
      },
      concreteMaterials: concreteDetails.materials,
      mixGrade: concreteDetails.mixGrade,
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Main tension rebar and bend detailing at landing junction must comply with IS 456 detailing requirements.'
    };
  }
}
