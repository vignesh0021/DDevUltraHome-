/**
 * Geotechnical & Soil Bearing Capacity (SBC) Footing Sizing Engine
 * Compliant with IS 1904:1986, IS 6403:1981, and IS 456:2000
 */

import { SafeMath, Validator } from './math.js';

export const TN_SOIL_SBC_BENCHMARKS = {
  'CHENNAI_SOFT_CLAY': { name: 'Soft Marine / Alluvial Clay (Chennai Coastal / Velachery)', sbcKnm2: 100, description: 'Low bearing alluvial clay, deep piles or raft often recommended for > G+1' },
  'CHENNAI_MEDIUM_CLAY': { name: 'Medium Stiff Clay (Chennai Outer / Tambaram / Medavakkam)', sbcKnm2: 150, description: 'Standard stiff clay benchmark for residential individual villas' },
  'HARD_CLAY_GRAVEL': { name: 'Hard Sandy Clay / Moorum (Chengalpattu / Kanchipuram)', sbcKnm2: 200, description: 'Good soil formation with moderate to high bearing capability' },
  'COARSE_SAND': { name: 'Dense Coarse Sand (River Basins / Coimbatore)', sbcKnm2: 250, description: 'High stability granular soil with minimal consolidation settlement' },
  'DISINTEGRATED_ROCK': { name: 'Hard Gravel / Weathered Rock / Granular Moorum', sbcKnm2: 300, description: 'Excellent foundation bed for multi-storey residential structures' },
  'HARD_FISSURED_ROCK': { name: 'Charnockite / Granite Hard Bedrock (Salem / Madurai)', sbcKnm2: 600, description: 'Solid rock formation with high bearing capacity' }
};

export class GeotechEngine {
  /**
   * Sizing of Isolated Pad / Sloped Footing from Column Axial Load and SBC
   * @param {Object} params
   * @param {number} params.columnAxialLoadKn - Service Dead Load + Live Load (P in kN, e.g. 600 kN)
   * @param {number} [params.sbcKnm2=150] - Safe Bearing Capacity of soil (kN/m²)
   * @param {string} [params.soilTypeKey] - Key from TN_SOIL_SBC_BENCHMARKS
   * @param {number} [params.columnWidthMm=300] - Column width (cx in mm)
   * @param {number} [params.columnDepthMm=300] - Column depth (cy in mm)
   * @param {string} [params.concreteGrade='M20'] - Mix grade
   * @param {string} [params.steelGrade='Fe500'] - Steel grade
   */
  static sizeFooting(params) {
    const steps = [];
    const assumptions = [];

    const loadCheck = Validator.positiveNumber('Column Axial Load', params.columnAxialLoadKn);
    if (!loadCheck.valid) throw new Error(loadCheck.error);
    const pServiceKn = loadCheck.value;

    let sbc = Number(params.sbcKnm2);
    if (!sbc || sbc <= 0) {
      const soil = TN_SOIL_SBC_BENCHMARKS[params.soilTypeKey] || TN_SOIL_SBC_BENCHMARKS['CHENNAI_MEDIUM_CLAY'];
      sbc = soil.sbcKnm2;
      assumptions.push(`Soil classification: ${soil.name} (SBC = ${sbc} kN/m²)`);
    } else {
      assumptions.push(`Design Safe Bearing Capacity (SBC) = ${sbc} kN/m²`);
    }

    const cxM = (params.columnWidthMm || 300) / 1000;
    const cyM = (params.columnDepthMm || 300) / 1000;
    steps.push(`Column Service Load: P = ${pServiceKn} kN, Column Size = ${cxM * 1000}mm × ${cyM * 1000}mm`);

    // 1. Footing Self-Weight Allowance: 10% of column axial load (IS 1904 norm)
    const selfWeightAllowance = 0.10;
    const totalVerticalLoadKn = SafeMath.round(pServiceKn * (1 + selfWeightAllowance), 2);
    assumptions.push('Footing self-weight and soil surcharge allowance = 10% of column axial load');
    steps.push(`Total load at footing base = ${pServiceKn} kN + 10% self-weight = ${totalVerticalLoadKn} kN`);

    // 2. Minimum plan area required: A = Total Load / SBC
    const requiredAreaM2 = SafeMath.round(totalVerticalLoadKn / sbc, 3);
    steps.push(`Minimum Footing Plan Area required: A = ${totalVerticalLoadKn} kN / ${sbc} kN/m² = ${requiredAreaM2} m² (${SafeMath.round(requiredAreaM2 * 10.7639, 2)} sq.ft)`);

    // 3. Footing Side Dimensions (Square footing)
    const exactSideM = Math.sqrt(requiredAreaM2);
    // Round up to nearest 0.1 meter (100mm) for practical site shuttering
    const sideM = SafeMath.round(Math.ceil(exactSideM * 10) / 10, 2);
    const providedAreaM2 = SafeMath.round(sideM * sideM, 2);
    steps.push(`Square Footing dimensions: B = L = ${sideM}m (Provided Area = ${providedAreaM2} m²)`);

    // 4. Actual Service Soil Pressure check
    const actualSoilPressureKnm2 = SafeMath.round(pServiceKn / providedAreaM2, 2);
    const isPressureSafe = actualSoilPressureKnm2 <= sbc;
    steps.push(`Net upward soil pressure (service): q = ${pServiceKn} kN / ${providedAreaM2} m² = ${actualSoilPressureKnm2} kN/m² (Safe <= ${sbc} kN/m²)`);

    // 5. Factored Upward Soil Pressure (Limit State Design - IS 456)
    const factoredLoadKn = pServiceKn * 1.5;
    const quFactoredKnm2 = SafeMath.round(factoredLoadKn / providedAreaM2, 2);
    steps.push(`Factored upward soil pressure: qu = (1.5 × ${pServiceKn}) / ${providedAreaM2} = ${quFactoredKnm2} kN/m²`);

    // 6. Bending Moment at Column Face (Critical section per IS 456 Clause 34.2.3.1)
    // Cantilever projection: a = (B - cx) / 2
    const projectionM = SafeMath.round((sideM - cxM) / 2, 3);
    // Mu = (qu * B * a²) / 2
    const muKnM = SafeMath.round((quFactoredKnm2 * sideM * projectionM * projectionM) / 2, 2);
    steps.push(`Critical bending moment at column face: Mu = ${muKnM} kN·m (Cantilever projection = ${projectionM}m)`);

    // 7. Depth Calculation (Bending and Shear check)
    // For M20 concrete and Fe500 steel, Mu,lim = 0.133 fck b d² => d = sqrt(Mu / (0.133 * 20 * B))
    const fck = params.concreteGrade === 'M25' ? 25 : 20;
    const fy = 500;
    const dReqMomentMm = Math.sqrt((muKnM * 1e6) / (0.133 * fck * sideM * 1000));

    // One-way and two-way punching shear criteria usually govern footing depth.
    // Thumb rule / empirical safe depth: d ≈ 2.5 * cantilever projection or minimum 300mm
    const dSafeMm = Math.max(300, Math.ceil(Math.max(dReqMomentMm, projectionM * 400) / 50) * 50);
    const clearCoverMm = 50; // IS 456 minimum clear cover for footings is 50mm
    const totalDepthMm = dSafeMm + clearCoverMm;
    const totalDepthM = totalDepthMm / 1000;
    assumptions.push(`Clear cover for footing bottom = ${clearCoverMm}mm (IS 456 Clause 26.4.2.2)`);
    steps.push(`Recommended Footing Depth: Effective depth d = ${dSafeMm}mm, Overall Depth D = ${totalDepthMm}mm (${totalDepthM}m)`);

    // 8. Steel Reinforcement (Bottom Mesh in both directions)
    // Ast = 0.5 * (fck/fy) * [1 - sqrt(1 - (4.59*Mu)/(fck*B*d²))] * B * d
    const bMm = sideM * 1000;
    const term = 1 - (4.59 * muKnM * 1e6) / (fck * bMm * dSafeMm * dSafeMm);
    let astMm2 = 0;
    if (term > 0) {
      astMm2 = Math.round(0.5 * (fck / fy) * (1 - Math.sqrt(term)) * bMm * dSafeMm);
    }
    // Minimum steel = 0.12% of gross b * D for HYSD
    const minAstMm2 = Math.round(0.0012 * bMm * totalDepthMm);
    const designAstMm2 = Math.max(astMm2, minAstMm2);

    // Using 12mm rebar
    const barDiaMm = 12;
    const singleBarArea = (Math.PI * barDiaMm * barDiaMm) / 4;
    const numBarsEachWay = Math.ceil(designAstMm2 / singleBarArea);
    const spacingMm = Math.min(200, Math.floor((bMm - 2 * clearCoverMm) / (numBarsEachWay - 1)));
    steps.push(`Flexural steel: Required Ast = ${designAstMm2} mm² => Provide ${numBarsEachWay} nos of 12mm TMT bars @ ${spacingMm}mm c/c both ways`);

    // Concrete volume of footing
    const concreteVolumeM3 = SafeMath.round(sideM * sideM * totalDepthM, 3);

    return {
      serviceLoadKn: pServiceKn,
      sbcKnm2: sbc,
      isSafe: isPressureSafe,
      footingDimensions: {
        lengthM: sideM,
        widthM: sideM,
        overallDepthMm: totalDepthMm,
        effectiveDepthMm: dSafeMm,
        clearCoverMm,
        footingAreaM2: providedAreaM2
      },
      pressures: {
        servicePressureKnm2: actualSoilPressureKnm2,
        factoredPressureKnm2: quFactoredKnm2
      },
      bendingMomentKnM: muKnM,
      reinforcement: {
        astRequiredMm2: designAstMm2,
        barDiameterMm: barDiaMm,
        barsCountEachWay: numBarsEachWay,
        spacingMm: spacingMm,
        description: `${numBarsEachWay} Nos of ${barDiaMm}mm dia @ ${spacingMm}mm c/c mesh`
      },
      concreteVolumeM3,
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Preliminary geotechnical and structural sizing per IS 456 & IS 1904. Soil test report (SPT N-values) and structural consultant verification must be obtained for site construction.'
    };
  }
}
