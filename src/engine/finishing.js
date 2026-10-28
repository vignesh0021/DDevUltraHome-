/**
 * Finishing Works Calculation Engine
 * Covers Plastering, Painting, Flooring, and Tiling
 * In accordance with IS 1200, CPWD, and Tamil Nadu PWD Specifications
 */

import { SafeMath, UnitConverter, Validator } from './math.js';
import { CONSTANTS } from './concrete.js';

export const PLASTER_SPECIFICATIONS = {
  'CEILING_6MM_1:3': { thicknessMm: 6, ratio: { cement: 1, sand: 3 }, description: 'Ceiling plaster (6mm 1:3)' },
  'INTERNAL_12MM_1:4': { thicknessMm: 12, ratio: { cement: 1, sand: 4 }, description: 'Internal wall plaster (12mm 1:4 - High finish)' },
  'INTERNAL_12MM_1:5': { thicknessMm: 12, ratio: { cement: 1, sand: 5 }, description: 'Internal wall plaster (12mm 1:5 - Standard)' },
  'INTERNAL_12MM_1:6': { thicknessMm: 12, ratio: { cement: 1, sand: 6 }, description: 'Internal wall plaster (12mm 1:6 - Economy)' },
  'EXTERNAL_15MM_1:4': { thicknessMm: 15, ratio: { cement: 1, sand: 4 }, description: 'External wall plaster (15mm 1:4 - Weather coat base)' },
  'EXTERNAL_20MM_1:4': { thicknessMm: 20, ratio: { cement: 1, sand: 4 }, description: 'External two-coat waterproof plaster (20mm 1:4)' }
};

export const TILE_SIZES = {
  'VITRIFIED_2X2': { name: 'Vitrified Tile 600x600 mm (2ft x 2ft)', lengthM: 0.6, widthM: 0.6, areaM2: 0.36, tilesPerBox: 4 },
  'VITRIFIED_4X2': { name: 'GVT/PGVT Tile 1200x600 mm (4ft x 2ft)', lengthM: 1.2, widthM: 0.6, areaM2: 0.72, tilesPerBox: 2 },
  'CERAMIC_1X1': { name: 'Ceramic Floor Tile 300x300 mm (1ft x 1ft)', lengthM: 0.3, widthM: 0.3, areaM2: 0.09, tilesPerBox: 10 },
  'WALL_DADO_1.5X1': { name: 'Ceramic Wall Tile 450x300 mm', lengthM: 0.45, widthM: 0.3, areaM2: 0.135, tilesPerBox: 6 },
  'GRANITE_SLAB': { name: 'Natural Granite Slabs', lengthM: 2.4, widthM: 0.75, areaM2: 1.8, isSlab: true }
};

export class FinishingEngine {
  /**
   * Plastering estimation
   * @param {Object} params
   * @param {number} params.areaM2 - Plastering area in sq.meters (or calculated from length and height)
   * @param {string} [params.spec='INTERNAL_12MM_1:5'] - Key from PLASTER_SPECIFICATIONS
   * @param {number} [params.wastagePercent=10] - Allowance for uneven brick joints and rebounds %
   */
  static calculatePlaster(params) {
    const steps = [];
    const assumptions = [];

    const aCheck = Validator.positiveNumber('Plastering Area', params.areaM2);
    if (!aCheck.valid) throw new Error(aCheck.error);
    const areaM2 = aCheck.value;
    const areaSqft = SafeMath.round(areaM2 * 10.7639, 2);

    const specKey = params.spec || 'INTERNAL_12MM_1:5';
    const spec = PLASTER_SPECIFICATIONS[specKey] || PLASTER_SPECIFICATIONS['INTERNAL_12MM_1:5'];
    steps.push(`Plaster specification: ${spec.description}`);

    const tM = spec.thicknessMm / 1000;
    const wetVolume = SafeMath.round(areaM2 * tM, 4);
    steps.push(`Theoretical wet plaster volume = ${areaM2} m² × ${tM}m = ${wetVolume} m³`);

    // In plastering, 20% to 30% extra mortar is required to fill joints and irregularities of masonry,
    // plus 30% to 33% dry-to-wet conversion factor. Total multiplier is approx 1.60.
    const jointFillingFactor = 1.20;
    const dryConversionFactor = 1.33;
    const wastage = Number(params.wastagePercent) || 5;
    const wastageMult = 1 + (wastage / 100);

    assumptions.push(`Joint filling & uneven surface factor = ${jointFillingFactor}`);
    assumptions.push(`Dry mortar expansion factor = ${dryConversionFactor}`);
    assumptions.push(`Rebound & handling wastage = ${wastage}%`);

    const dryVolume = SafeMath.round(wetVolume * jointFillingFactor * dryConversionFactor * wastageMult, 4);
    steps.push(`Required dry mortar volume = ${wetVolume} × ${jointFillingFactor} × ${dryConversionFactor} × ${wastageMult} = ${dryVolume} m³`);

    const totalParts = spec.ratio.cement + spec.ratio.sand;
    const cementVol = SafeMath.round((spec.ratio.cement / totalParts) * dryVolume, 4);
    const cementKg = SafeMath.round(cementVol * CONSTANTS.CEMENT_DENSITY_KG_M3, 1);
    const cementBags = SafeMath.round(cementKg / CONSTANTS.CEMENT_BAG_WEIGHT_KG, 2);

    const sandVol = SafeMath.round((spec.ratio.sand / totalParts) * dryVolume, 4);
    const sandCft = SafeMath.round(sandVol * CONSTANTS.CFT_PER_M3, 2);
    const sandUnits = SafeMath.round(sandCft / CONSTANTS.CFT_PER_TN_UNIT, 3);
    const sandTonnes = SafeMath.round((sandVol * CONSTANTS.SAND_DENSITY_KG_M3) / 1000, 3);

    steps.push(`Constituents: Cement = ${cementKg} kg (~${Math.ceil(cementBags)} bags), Sand = ${sandCft} cft (${sandUnits} TN Units)`);

    return {
      workType: 'Plastering',
      workTypeCode: 'PLASTER',
      spec: spec.description,
      thicknessMm: spec.thicknessMm,
      areaM2,
      areaSqft,
      dryVolumeM3: dryVolume,
      materials: {
        cementBags: Math.ceil(cementBags),
        sandM3: sandVol,
        sandTnUnits: sandUnits,
        cement: {
          volumeM3: cementVol,
          weightKg: cementKg,
          bags: cementBags,
          bagsRounded: Math.ceil(cementBags),
          unit: '50kg Bags'
        },
        sand: {
          volumeM3: sandVol,
          volumeCft: sandCft,
          tnUnits: sandUnits,
          weightTonnes: sandTonnes,
          unit: 'cft / TN Units'
        }
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'For external double coat, ensure rich cement water slurry coat (chia-chia) before second coat.'
    };
  }

  /**
   * Painting & Wall Care Estimation
   * @param {Object} params
   * @param {number} [params.wallAreaM2] - Surface area in sq.meters
   * @param {number} [params.areaM2] - Alternative parameter for surface area
   * @param {boolean} [params.includePutty=true] - 2 coats wall putty
   * @param {boolean} [params.includePrimer=true] - 1 coat primer
   * @param {boolean} [params.includeEmulsion=true] - 2 coats acrylic emulsion paint
   */
  static calculatePainting(params) {
    const steps = [];
    const assumptions = [];

    const areaInput = params.wallAreaM2 !== undefined ? params.wallAreaM2 : params.areaM2;
    const aCheck = Validator.positiveNumber('Painting Area', areaInput);
    if (!aCheck.valid) throw new Error(aCheck.error);
    const areaM2 = aCheck.value;
    const areaSqft = SafeMath.round(areaM2 * 10.7639, 2);
    steps.push(`Total painting surface area = ${areaM2} m² (${areaSqft} sq.ft)`);

    const result = {
      workType: 'Painting & Surface Preparation',
      workTypeCode: 'PAINT',
      areaM2,
      areaSqft,
      materials: {}
    };

    // 1. Wall Putty (2 coats): Coverage approx 14 - 18 sq.ft per kg for 2 coats
    if (params.includePutty !== false) {
      const puttyCoverageSqftPerKg = 16; // Standard Asian Paints / Birla White
      const puttyKg = SafeMath.round(areaSqft / puttyCoverageSqftPerKg, 1);
      const puttyBags40Kg = Math.ceil(puttyKg / 40);
      assumptions.push(`Wall Putty 2 coats coverage = ${puttyCoverageSqftPerKg} sq.ft / kg`);
      steps.push(`Wall Putty (2 coats): ${areaSqft} sq.ft / ${puttyCoverageSqftPerKg} = ${puttyKg} kg (${puttyBags40Kg} bags of 40kg)`);
      result.materials.putty = {
        weightKg: puttyKg,
        bags40Kg: puttyBags40Kg,
        unit: '40kg Bags'
      };
    }

    // 2. Wall Primer (1 coat): Coverage approx 120 - 140 sq.ft per Litre
    if (params.includePrimer !== false) {
      const primerCoverageSqftPerLitre = 130;
      const primerLitres = SafeMath.round(areaSqft / primerCoverageSqftPerLitre, 1);
      assumptions.push(`Interior/Exterior Primer 1 coat coverage = ${primerCoverageSqftPerLitre} sq.ft / Litre`);
      steps.push(`Primer (1 coat): ${areaSqft} sq.ft / ${primerCoverageSqftPerLitre} = ${primerLitres} Litres`);
      result.materials.primer = {
        litres: primerLitres,
        litresRounded: Math.ceil(primerLitres),
        unit: 'Litres'
      };
    }

    // 3. Emulsion Paint (2 coats): Coverage approx 60 - 75 sq.ft per Litre for 2 coats
    if (params.includeEmulsion !== false) {
      const paintCoverageSqftPerLitre = 65;
      const paintLitres = SafeMath.round(areaSqft / paintCoverageSqftPerLitre, 1);
      assumptions.push(`Emulsion Topcoat 2 coats coverage = ${paintCoverageSqftPerLitre} sq.ft / Litre`);
      steps.push(`Emulsion Paint (2 coats): ${areaSqft} sq.ft / ${paintCoverageSqftPerLitre} = ${paintLitres} Litres`);
      result.materials.paint = {
        litres: paintLitres,
        litresRounded: Math.ceil(paintLitres),
        unit: 'Litres'
      };
    }

    // Convenience aliases for frontend rendering
    result.materials.puttyKg = result.materials.putty?.weightKg || 0;
    result.materials.primerLitres = result.materials.primer?.litres || 0;
    result.materials.emulsionPaintLitres = result.materials.paint?.litres || 0;

    result.assumptions = assumptions;
    result.calculationSteps = steps;
    result.disclaimer = 'Paint coverage varies with surface porosity, moisture content, dilution with water, and application technique (brush, roller, or spray).';
    return result;
  }

  /**
   * Flooring & Tiling Estimation
   * @param {Object} params
   * @param {number} [params.floorAreaM2] - Room floor area in sq.meters
   * @param {number} [params.areaM2] - Alternative parameter for floor area
   * @param {number} [params.perimeterM=0] - Perimeter for 4" (100mm) skirting
   * @param {string} [params.tileType='VITRIFIED_2X2'] - Key from TILE_SIZES
   * @param {number} [params.tileWastagePercent=8] - Tile cutting wastage %
   * @param {number} [params.mortarBedThicknessMm=25] - Bedding thickness in mm
   * @param {string} [params.bedMortarMix='1:5']
   */
  static calculateFlooring(params) {
    const steps = [];
    const assumptions = [];

    const areaInput = params.floorAreaM2 !== undefined ? params.floorAreaM2 : params.areaM2;
    const aCheck = Validator.positiveNumber('Floor Area', areaInput);
    if (!aCheck.valid) throw new Error(aCheck.error);
    const floorAreaM2 = aCheck.value;
    const floorAreaSqft = SafeMath.round(floorAreaM2 * 10.7639, 2);

    // Skirting calculation (4 inches / 100mm height)
    const perimM = Number(params.perimeterM) || 0;
    const skirtingAreaM2 = SafeMath.round(perimM * 0.10, 2);
    const totalTilingAreaM2 = SafeMath.round(floorAreaM2 + skirtingAreaM2, 2);
    const totalTilingAreaSqft = SafeMath.round(totalTilingAreaM2 * 10.7639, 2);

    steps.push(`Floor area = ${floorAreaM2} m² (${floorAreaSqft} sq.ft)`);
    if (perimM > 0) {
      steps.push(`Skirting (100mm height) along ${perimM}m perimeter = ${skirtingAreaM2} m²`);
      steps.push(`Total tiling area (Floor + Skirting) = ${totalTilingAreaM2} m² (${totalTilingAreaSqft} sq.ft)`);
    }

    const tKey = params.tileType || 'VITRIFIED_2X2';
    const tile = TILE_SIZES[tKey] || TILE_SIZES['VITRIFIED_2X2'];
    assumptions.push(`Selected tile: ${tile.name}`);

    // Tile count
    const exactTiles = totalTilingAreaM2 / tile.areaM2;
    const wastage = Number(params.tileWastagePercent) || 8;
    const tilesRequired = Math.ceil(exactTiles * (1 + wastage / 100));
    const boxes = tile.tilesPerBox ? Math.ceil(tilesRequired / tile.tilesPerBox) : null;

    steps.push(`Each tile area = ${tile.areaM2} m²`);
    steps.push(`Exact tile count = ${SafeMath.round(exactTiles, 1)} nos.`);
    steps.push(`Tile requirement with ${wastage}% cutting wastage = ${tilesRequired} tiles (${boxes ? `${boxes} boxes of ${tile.tilesPerBox}` : 'Slabs'})`);

    // Cement Mortar Bedding (25mm 1:4 or 1:5 bed under tiles)
    const bedThickM = (params.mortarBedThicknessMm || 25) / 1000;
    const wetBedVolume = SafeMath.round(floorAreaM2 * bedThickM, 4);
    const dryBedVolume = SafeMath.round(wetBedVolume * 1.33, 4);
    assumptions.push(`Cement mortar bedding thickness = ${bedThickM * 1000}mm (dry mortar factor 1.33)`);

    // Mortar ratio 1:5
    const bedRatio = { cement: 1, sand: 5 };
    const parts = bedRatio.cement + bedRatio.sand;
    const bedCementM3 = (bedRatio.cement / parts) * dryBedVolume;
    const bedCementKg = SafeMath.round(bedCementM3 * CONSTANTS.CEMENT_DENSITY_KG_M3, 1);
    const bedCementBags = SafeMath.round(bedCementKg / CONSTANTS.CEMENT_BAG_WEIGHT_KG, 2);

    const bedSandM3 = (bedRatio.sand / parts) * dryBedVolume;
    const bedSandCft = SafeMath.round(bedSandM3 * CONSTANTS.CFT_PER_M3, 2);
    const bedSandUnits = SafeMath.round(bedSandCft / CONSTANTS.CFT_PER_TN_UNIT, 3);

    // Cement slurry for fixing tiles: ~3.5 to 4.4 kg cement per sq.meter
    const slurryCementKg = SafeMath.round(floorAreaM2 * 4.0, 1);
    const slurryBags = SafeMath.round(slurryCementKg / CONSTANTS.CEMENT_BAG_WEIGHT_KG, 2);
    assumptions.push(`Cement paste / slurry for fixing = 4.0 kg/m²`);

    const totalCementBags = SafeMath.round(bedCementBags + slurryBags, 2);
    steps.push(`Bedding Mortar: Cement = ${bedCementBags} bags, Sand = ${bedSandCft} cft (${bedSandUnits} TN Units)`);
    steps.push(`Cement slurry: ${slurryCementKg} kg (~${slurryBags} bags). Total Cement = ~${Math.ceil(totalCementBags)} bags`);

    // Tile Grout (approx 1 kg per 50 sq.ft for standard 2mm tile spacers)
    const groutKg = SafeMath.round(totalTilingAreaSqft / 50, 1);
    steps.push(`Epoxy/Cement Tile Grout = ${groutKg} kg`);

    return {
      workType: 'Flooring & Tiling',
      workTypeCode: 'TILES',
      tileType: tile.name,
      areas: { floorAreaM2, skirtingAreaM2, totalAreaM2: totalTilingAreaM2, totalAreaSqft: totalTilingAreaSqft },
      tiles: {
        countExact: SafeMath.round(exactTiles, 1),
        countRequired: tilesRequired,
        boxesRequired: boxes,
        tilesPerBox: tile.tilesPerBox,
        wastagePercent: wastage,
        unit: 'Tiles'
      },
      beddingMaterials: {
        cement: {
          bedBags: bedCementBags,
          slurryBags: slurryBags,
          totalBags: totalCementBags,
          totalBagsRounded: Math.ceil(totalCementBags),
          unit: '50kg Bags'
        },
        sand: {
          volumeCft: bedSandCft,
          tnUnits: bedSandUnits,
          unit: 'cft / TN Units'
        },
        groutKg: groutKg
      },
      materials: {
        tilesCount: boxes || tilesRequired,
        netTileAreaM2: floorAreaM2,
        beddingCementBags: Math.ceil(totalCementBags),
        beddingSandTnUnits: bedSandUnits
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'For vitrified tiles, polymer-modified tile adhesive (e.g. Roff/Fosroc) can replace thick mortar bed on leveled PCC.'
    };
  }
}
