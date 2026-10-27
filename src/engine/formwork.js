/**
 * Shuttering, Formwork & Centering Engine
 * In accordance with IS 1200 Part 5 and Tamil Nadu PWD Specifications
 */

import { SafeMath, Validator } from './math.js';

export const PLYWOOD_SHEET_SQFT = 32; // Standard 8ft x 4ft (2.44m x 1.22m) = 2.977 m²
export const PLYWOOD_SHEET_M2 = 2.977;

export class FormworkEngine {
  /**
   * Calculate shuttering area and staging requirements
   * @param {Object} params
   * @param {string} params.elementType - 'SLAB', 'BEAM', 'COLUMN', 'FOOTING', 'STAIRCASE', 'WALL'
   * @param {number} params.lengthM - Length in meters
   * @param {number} params.widthM - Width in meters
   * @param {number} [params.depthM=0] - Depth / thickness / height in meters
   * @param {number} [params.count=1] - Number of elements
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const type = (params.elementType || 'SLAB').toUpperCase();
    const l = Number(params.lengthM) || 0;
    const w = Number(params.widthM) || 0;
    const d = Number(params.depthM) || 0;
    const count = Number(params.count) || 1;

    if (l <= 0) throw new Error('Length must be positive for formwork calculation.');

    let unitContactAreaM2 = 0;

    switch (type) {
      case 'SLAB':
        // Bottom soffit + side perimeter faces
        unitContactAreaM2 = (l * w) + (2 * (l + w) * (d || 0.125));
        steps.push(`Slab Formwork: Bottom Soffit (${l} × ${w} = ${l*w} m²) + Perimeter Edges (2 × (${l} + ${w}) × ${d||0.125} = ${SafeMath.round(2*(l+w)*(d||0.125), 2)} m²)`);
        break;

      case 'BEAM':
        // Bottom soffit + 2 vertical sides
        unitContactAreaM2 = (w * l) + (2 * d * l);
        steps.push(`Beam Formwork: Bottom (${w} × ${l} = ${w*l} m²) + 2 Sides (2 × ${d} × ${l} = ${2*d*l} m²)`);
        break;

      case 'COLUMN':
        // 4 vertical side faces
        unitContactAreaM2 = 2 * (l + w) * (d || 3.0); // Here d is height if l and w are cross section
        steps.push(`Column Formwork: 4 Faces Perimeter 2(${l} + ${w}) × Height ${d||3.0}m`);
        break;

      case 'FOOTING':
        // 4 side faces of isolated footing
        unitContactAreaM2 = 2 * (l + w) * d;
        steps.push(`Footing Formwork: 4 Vertical Sides 2(${l} + ${w}) × Depth ${d}m`);
        break;

      case 'WALL':
        // 2 sides of retaining wall or shear wall
        unitContactAreaM2 = 2 * l * (d || w);
        steps.push(`Retaining/Shear Wall: 2 Sides Contact Area 2 × ${l}m × ${d || w}m`);
        break;

      default:
        unitContactAreaM2 = l * w;
        steps.push(`Generic Formwork: ${l}m × ${w}m`);
    }

    const totalContactAreaM2 = SafeMath.round(unitContactAreaM2 * count, 2);
    const totalContactAreaSqft = SafeMath.round(totalContactAreaM2 * 10.7639, 2);

    // Number of 8ft x 4ft shuttering ply sheets
    const plySheetsExact = totalContactAreaM2 / PLYWOOD_SHEET_M2;
    const plySheetsRequired = Math.ceil(plySheetsExact * 1.05); // 5% cutting wastage
    assumptions.push('Shuttering Plywood standard size: 8ft × 4ft (12mm or 18mm BWP marine plywood)');

    // Shuttering mould release oil (~35 sq.m per Litre)
    const shutteringOilLitres = SafeMath.round(totalContactAreaM2 / 35, 1);
    assumptions.push('Shuttering oil / mould release agent coverage = 35 m² / Litre');

    // MS Acrow Props (approx 1 prop per 1.2 m² for slabs and beams)
    const propsRequired = (type === 'SLAB' || type === 'BEAM') 
      ? Math.ceil(totalContactAreaM2 / 1.2) 
      : 0;

    return {
      elementType: type,
      count,
      contactAreaM2: totalContactAreaM2,
      contactAreaSqft: totalContactAreaSqft,
      materials: {
        plywoodSheets8x4: plySheetsRequired,
        plywoodExact: SafeMath.round(plySheetsExact, 1),
        shutteringOilLitres: shutteringOilLitres,
        acrowPropsCount: propsRequired
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Striking times of formwork must comply with IS 456 Table 11 (e.g. vertical faces 16-24 hrs, slab soffit 3-7 days, beam props 14-21 days).'
    };
  }
}
