/**
 * Masonry Calculation Engine
 * Covers Modular Bricks, Traditional TN Country Bricks, Fly-ash Bricks, and AAC Blocks
 * Follows IS 2212:1991, IS 1200 Part 3, and Tamil Nadu PWD Specifications
 */

import { SafeMath, UnitConverter, Validator } from './math.js';
import { CONSTANTS } from './concrete.js';

export const BRICK_TYPES = {
  'MODULAR_BRICK': {
    name: 'Standard Modular Brick',
    lengthMm: 190,
    widthMm: 90,
    heightMm: 90,
    nominalLengthMm: 200,
    nominalWidthMm: 100,
    nominalHeightMm: 100,
    mortarThicknessMm: 10,
    hasFrog: true
  },
  'TRADITIONAL_TN_BRICK': {
    name: 'Traditional Wire-Cut / Country Brick (TN)',
    lengthMm: 228.6, // 9 inches
    widthMm: 107.95, // 4.25 inches
    heightMm: 69.85, // 2.75 inches
    nominalLengthMm: 238.6,
    nominalWidthMm: 117.95,
    nominalHeightMm: 79.85,
    mortarThicknessMm: 10,
    hasFrog: true
  },
  'FLY_ASH_BRICK': {
    name: 'Fly-Ash Brick',
    lengthMm: 230,
    widthMm: 110,
    heightMm: 70,
    nominalLengthMm: 240,
    nominalWidthMm: 120,
    nominalHeightMm: 80,
    mortarThicknessMm: 10,
    hasFrog: true
  },
  'AAC_BLOCK_100': {
    name: 'AAC Block (4" Partition - 600x200x100mm)',
    lengthMm: 600,
    widthMm: 100,
    heightMm: 200,
    nominalLengthMm: 603,
    nominalWidthMm: 100,
    nominalHeightMm: 203,
    mortarThicknessMm: 3, // Thin-bed polymer adhesive
    isBlock: true
  },
  'AAC_BLOCK_150': {
    name: 'AAC Block (6" Semi-load - 600x200x150mm)',
    lengthMm: 600,
    widthMm: 150,
    heightMm: 200,
    nominalLengthMm: 603,
    nominalWidthMm: 150,
    nominalHeightMm: 203,
    mortarThicknessMm: 3,
    isBlock: true
  },
  'AAC_BLOCK_200': {
    name: 'AAC Block (8" External - 600x200x200mm)',
    lengthMm: 600,
    widthMm: 200,
    heightMm: 200,
    nominalLengthMm: 603,
    nominalWidthMm: 200,
    nominalHeightMm: 203,
    mortarThicknessMm: 3,
    isBlock: true
  },
  'CONCRETE_SOLID_BLOCK': {
    name: 'Solid Concrete Block (400x200x200mm)',
    lengthMm: 400,
    widthMm: 200,
    heightMm: 200,
    nominalLengthMm: 410,
    nominalWidthMm: 200,
    nominalHeightMm: 210,
    mortarThicknessMm: 10,
    isBlock: true
  }
};

export const MORTAR_MIXES = {
  '1:3': { cement: 1, sand: 3, description: 'High strength / parapet / damp proof' },
  '1:4': { cement: 1, sand: 4, description: 'External 9" walls, load-bearing masonry' },
  '1:5': { cement: 1, sand: 5, description: 'Standard residential masonry' },
  '1:6': { cement: 1, sand: 6, description: 'Internal partition walls / non-load bearing' }
};

export class MasonryEngine {
  /**
   * Masonry calculation
   * @param {Object} params
   * @param {number} params.wallLength - Length of wall in meters
   * @param {number} params.wallHeight - Height of wall in meters
   * @param {number} [params.wallThicknessMm=230] - Wall thickness in mm (e.g. 230mm for 9" wall, 115mm for 4.5" wall)
   * @param {string} [params.brickType='TRADITIONAL_TN_BRICK'] - Key from BRICK_TYPES
   * @param {string} [params.mortarMix='1:5'] - Key from MORTAR_MIXES
   * @param {Array<{width: number, height: number, count?: number}>} [params.deductions] - Openings (doors, windows)
   * @param {number} [params.brickWastagePercent=5] - Wastage for bricks/blocks %
   * @param {number} [params.mortarWastagePercent=10] - Wastage for mortar %
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const lCheck = Validator.positiveNumber('Wall Length', params.wallLength);
    const hCheck = Validator.positiveNumber('Wall Height', params.wallHeight);
    if (!lCheck.valid) throw new Error(lCheck.error);
    if (!hCheck.valid) throw new Error(hCheck.error);

    const lM = lCheck.value;
    const hM = hCheck.value;
    const tMm = Number(params.wallThicknessMm) || 230;
    const tM = tMm / 1000;

    const grossWallArea = SafeMath.round(lM * hM, 3);
    const grossWallVolume = SafeMath.round(grossWallArea * tM, 4);
    steps.push(`Gross wall dimensions = ${lM}m (L) × ${hM}m (H) × ${tMm}mm (Thick) => Gross Area = ${grossWallArea} m², Gross Volume = ${grossWallVolume} m³`);

    // Deduct openings (doors, windows)
    let openingArea = 0;
    if (Array.isArray(params.deductions) && params.deductions.length > 0) {
      params.deductions.forEach((op, idx) => {
        const count = op.count || 1;
        const opW = Number(op.width) || 0;
        const opH = Number(op.height) || 0;
        const area = opW * opH * count;
        openingArea += area;
        steps.push(`Deduction #${idx + 1}: ${count} opening(s) of ${opW}m × ${opH}m = -${SafeMath.round(area, 2)} m²`);
      });
    }

    const netWallArea = Math.max(0, SafeMath.round(grossWallArea - openingArea, 3));
    const netWallVolume = Math.max(0, SafeMath.round(netWallArea * tM, 4));
    if (netWallVolume <= 0) {
      throw new Error('Net masonry volume after deductions must be greater than zero.');
    }
    steps.push(`Net wall masonry area = ${netWallArea} m² (${SafeMath.round(netWallArea * 10.7639, 2)} sq.ft), Net Volume = ${netWallVolume} m³ (${SafeMath.round(netWallVolume * CONSTANTS.CFT_PER_M3, 2)} cft)`);

    // Selected Brick/Block
    const bKey = params.brickType || 'TRADITIONAL_TN_BRICK';
    const brick = BRICK_TYPES[bKey] || BRICK_TYPES['TRADITIONAL_TN_BRICK'];
    assumptions.push(`Selected masonry unit: ${brick.name} (${brick.lengthMm} × ${brick.widthMm} × ${brick.heightMm} mm)`);

    // Volume of 1 brick with mortar
    const nomL = brick.nominalLengthMm / 1000;
    const nomW = brick.nominalWidthMm / 1000;
    const nomH = brick.nominalHeightMm / 1000;
    const singleNominalVolume = nomL * nomW * nomH;

    // Volume of 1 brick without mortar
    const actL = brick.lengthMm / 1000;
    const actW = brick.widthMm / 1000;
    const actH = brick.heightMm / 1000;
    const singleActualVolume = actL * actW * actH;

    // Number of bricks required = Net wall volume / Nominal volume of 1 brick
    const exactBricksCount = netWallVolume / singleNominalVolume;
    const brickWastage = Number(params.brickWastagePercent) || 5;
    const totalBricksWithWastage = Math.ceil(exactBricksCount * (1 + brickWastage / 100));
    steps.push(`Nominal brick volume with mortar = ${nomL} × ${nomW} × ${nomH} = ${SafeMath.round(singleNominalVolume, 6)} m³`);
    steps.push(`Theoretical brick count = ${netWallVolume} m³ / ${SafeMath.round(singleNominalVolume, 6)} m³ = ${SafeMath.round(exactBricksCount, 1)} nos.`);
    steps.push(`Final brick requirement with ${brickWastage}% wastage = ${totalBricksWithWastage} nos.`);

    // Wet Mortar Volume = Net Wall Volume - Actual volume of bricks used (without wastage)
    const actualBrickVolumeTotal = exactBricksCount * singleActualVolume;
    let wetMortarVolume = Math.max(0, netWallVolume - actualBrickVolumeTotal);

    // Add frog volume and joint irregularity adjustment (approx 15% of wet mortar)
    if (brick.hasFrog) {
      wetMortarVolume = wetMortarVolume * 1.15;
      assumptions.push('Added 15% allowance to mortar for brick frog filling, uneven bed joints, and wastage');
    }

    // Dry Mortar Factor (Dry volume of mortar is 1.30 to 1.33 times wet volume)
    const DRY_MORTAR_FACTOR = 1.33;
    const mortarWastage = Number(params.mortarWastagePercent) || 5;
    const dryMortarVolume = SafeMath.round(wetMortarVolume * DRY_MORTAR_FACTOR * (1 + mortarWastage / 100), 4);
    steps.push(`Dry mortar volume = ${SafeMath.round(wetMortarVolume, 4)} m³ wet × ${DRY_MORTAR_FACTOR} (dry factor) × ${1 + mortarWastage/100} = ${dryMortarVolume} m³`);

    // Mortar ingredients (Cement & Sand)
    const mKey = params.mortarMix || '1:5';
    const mix = MORTAR_MIXES[mKey] || MORTAR_MIXES['1:5'];
    const totalMortarParts = mix.cement + mix.sand;

    const cementVolumeM3 = SafeMath.round((mix.cement / totalMortarParts) * dryMortarVolume, 4);
    const cementKg = SafeMath.round(cementVolumeM3 * CONSTANTS.CEMENT_DENSITY_KG_M3, 1);
    const cementBags = SafeMath.round(cementKg / CONSTANTS.CEMENT_BAG_WEIGHT_KG, 2);

    const sandVolumeM3 = SafeMath.round((mix.sand / totalMortarParts) * dryMortarVolume, 4);
    const sandCft = SafeMath.round(sandVolumeM3 * CONSTANTS.CFT_PER_M3, 2);
    const sandTnUnits = SafeMath.round(sandCft / CONSTANTS.CFT_PER_TN_UNIT, 3);
    const sandTonnes = SafeMath.round((sandVolumeM3 * CONSTANTS.SAND_DENSITY_KG_M3) / 1000, 3);

    steps.push(`Mortar Mix ${mKey}: Cement = ${cementKg} kg (~${Math.ceil(cementBags)} bags), Sand = ${sandCft} cft (${sandTnUnits} TN Units)`);

    return {
      element: 'Brick & Block Masonry',
      wallDimensions: { lengthM: lM, heightM: hM, thicknessMm: tMm },
      grossAreaM2: grossWallArea,
      netAreaM2: netWallArea,
      netVolumeM3: netWallVolume,
      netVolumeCft: SafeMath.round(netWallVolume * CONSTANTS.CFT_PER_M3, 2),
      brickType: brick.name,
      mortarMix: mKey,
      materials: {
        bricks: {
          countExact: SafeMath.round(exactBricksCount, 1),
          countRequired: totalBricksWithWastage,
          wastagePercent: brickWastage,
          unit: 'Nos'
        },
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
          tnUnits: sandTnUnits,
          weightTonnes: sandTonnes,
          unit: 'cft / TN Units'
        }
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Brick masonry numbers depend on site breaking, raking of joints, and quality of clay/AAC units. Stored dry mortar factor 1.33.'
    };
  }
}
