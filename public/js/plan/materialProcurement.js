/**
 * Material Procurement & Bill of Materials (BOM) Engine
 * Translates confirmed BOQ quantities into theoretical and commercial procurement packs
 * strictly avoiding double counting and factoring standard Tamil Nadu quarry/retail pack sizes
 */

import { SafeMath } from '../engine/math.js';

export class MaterialProcurementEngine {
  /**
   * Aggregate material procurement requirements from BOQ line items
   * @param {Array<Object>} boqItems - Array of BOQ items from BoqGenerator
   * @param {Object} [districtRates] - Current rates catalog
   */
  static generateProcurementList(boqItems) {
    if (!Array.isArray(boqItems)) return [];

    let totalRccM3 = 0;
    let totalPccM3 = 0;
    let totalSteelKg = 0;
    let totalBrickM3 = 0;
    let totalPlasterM2 = 0;
    let totalFlooringM2 = 0;
    let totalPaintingM2 = 0;

    for (const itm of boqItems) {
      const code = itm.itemCode || '';
      const qty = Number(itm.netQuantity) || 0;

      if (code === 'ITEM-02') totalPccM3 += qty;
      else if (code === 'ITEM-03' || code === 'ITEM-04' || code === 'ITEM-05' || code === 'ITEM-06') totalRccM3 += qty;
      else if (code === 'ITEM-07') totalSteelKg += qty;
      else if (code === 'ITEM-09') totalBrickM3 += qty;
      else if (code === 'ITEM-11') totalPlasterM2 += qty;
      else if (code === 'ITEM-12') totalFlooringM2 += qty;
      else if (code === 'ITEM-13') totalPaintingM2 += qty;
    }

    const materials = [];

    // 1. CEMENT (50 kg Bags)
    // PCC (1:4:8): ~3.4 bags/m³
    // RCC M25 (1:1:2): ~8.2 bags/m³
    // Brickwork (1:5): ~1.3 bags/m³
    // Plastering 12mm (1:5): ~0.08 bags/m²
    // Flooring Bed: ~0.15 bags/m²
    const pccCementBags = totalPccM3 * 3.4;
    const rccCementBags = totalRccM3 * 8.2;
    const brickCementBags = totalBrickM3 * 1.35;
    const plasterCementBags = totalPlasterM2 * 0.085;
    const floorCementBags = totalFlooringM2 * 0.15;
    const rawCementBags = pccCementBags + rccCementBags + brickCementBags + plasterCementBags + floorCementBags;
    const orderCementBags = Math.ceil(rawCementBags * 1.02); // 2% site handling waste

    materials.push({
      materialCode: 'MAT-CEM-01',
      name: 'Cement (OPC 53 / PPC 50kg Bags)',
      category: 'Cementitious',
      specification: 'IS 12269 (OPC 53) / IS 1489 (PPC) - Dalmia/UltraTech/Ramco',
      theoreticalQuantity: SafeMath.round(rawCementBags, 1),
      wastagePercent: 2.0,
      orderQuantity: orderCementBags,
      unit: 'Bags (50kg)',
      equivalentTonnes: SafeMath.round(orderCementBags * 0.05, 2),
      standardPackSize: '50 kg HDPE Bag / 20 Bags per Tonne',
      estimatedRateInr: 390.0,
      totalCostInr: SafeMath.round(orderCementBags * 390, 2)
    });

    // 2. M-SAND (Manufactured Sand for Concreting & Plastering)
    // Concreting sand: RCC ~0.45 m³/m³ + PCC ~0.45 m³/m³
    // Brickwork sand: ~0.26 m³/m³
    // Plastering sand (P-Sand): ~0.015 m³/m²
    const concSandM3 = (totalRccM3 + totalPccM3) * 0.45;
    const brickSandM3 = totalBrickM3 * 0.26;
    const plasterSandM3 = totalPlasterM2 * 0.015;
    const totalSandM3 = concSandM3 + brickSandM3 + plasterSandM3;
    const totalSandCft = SafeMath.round(totalSandM3 * 35.3147, 1);
    const orderSandTnUnits = SafeMath.round((totalSandCft * 1.03) / 100, 2); // 3% waste in TN Units (100 cft)

    materials.push({
      materialCode: 'MAT-SND-01',
      name: 'M-Sand & P-Sand (Manufactured Sand)',
      category: 'Aggregates',
      specification: 'IS 383 Zone II Crushed Rock Sand washed & air-classified',
      theoreticalQuantity: SafeMath.round(totalSandCft, 1),
      wastagePercent: 3.0,
      orderQuantity: orderSandTnUnits,
      unit: 'TN Units (100 cft)',
      equivalentCft: SafeMath.round(orderSandTnUnits * 100, 1),
      standardPackSize: '2.5 Units (250 cft) or 3 Units (300 cft) Tipper Lorry',
      estimatedRateInr: 4500.0,
      totalCostInr: SafeMath.round(orderSandTnUnits * 4500, 2)
    });

    // 3. BLUE METAL COARSE AGGREGATE (20mm & 40mm)
    // RCC 20mm aggregate: ~0.85 m³/m³
    // PCC 40mm aggregate: ~0.85 m³/m³
    const agg20mmM3 = totalRccM3 * 0.85;
    const agg40mmM3 = totalPccM3 * 0.85;
    const aggTotalM3 = agg20mmM3 + agg40mmM3;
    const aggTotalCft = SafeMath.round(aggTotalM3 * 35.3147, 1);
    const orderAggTnUnits = SafeMath.round((aggTotalCft * 1.03) / 100, 2);

    materials.push({
      materialCode: 'MAT-AGG-01',
      name: 'Blue Metal Granite Aggregate (20mm & 40mm)',
      category: 'Aggregates',
      specification: 'IS 383 Machine-crushed hard blue granite metal',
      theoreticalQuantity: SafeMath.round(aggTotalCft, 1),
      wastagePercent: 3.0,
      orderQuantity: orderAggTnUnits,
      unit: 'TN Units (100 cft)',
      equivalentCft: SafeMath.round(orderAggTnUnits * 100, 1),
      standardPackSize: '3 Units (300 cft) Heavy Tipper',
      estimatedRateInr: 3800.0,
      totalCostInr: SafeMath.round(orderAggTnUnits * 3800, 2)
    });

    // 4. REINFORCEMENT STEEL (Fe550D TMT)
    const steelTonnes = SafeMath.round((totalSteelKg * 1.03) / 1000, 2); // 3% cut-piece waste
    materials.push({
      materialCode: 'MAT-STL-01',
      name: 'Fe550D High-Ductility TMT Rebar (8mm to 20mm)',
      category: 'Metals & Rebar',
      specification: 'IS 1786 Fe550D Primary Steel (Tata Tiscon / JSW / SAIL / Kamachi)',
      theoreticalQuantity: SafeMath.round(totalSteelKg, 1),
      wastagePercent: 3.0,
      orderQuantity: steelTonnes,
      unit: 'Tonnes (MT)',
      equivalentKg: SafeMath.round(steelTonnes * 1000, 0),
      standardPackSize: '12m Standard Commercial Length Bundles',
      estimatedRateInr: 64500.0,
      totalCostInr: SafeMath.round(steelTonnes * 64500, 2)
    });

    // 5. TRADITIONAL WIRE-CUT COUNTRY BRICKS
    // ~500 bricks per m³ of masonry
    const rawBricks = totalBrickM3 * 500;
    const orderBricks = Math.ceil(rawBricks * 1.05); // 5% breakage
    materials.push({
      materialCode: 'MAT-BRK-01',
      name: 'Traditional Wire-Cut Red Country Bricks',
      category: 'Masonry',
      specification: '9" x 4.25" x 2.75" kiln-burnt high-compressive clay bricks',
      theoreticalQuantity: Math.round(rawBricks),
      wastagePercent: 5.0,
      orderQuantity: orderBricks,
      unit: 'Nos',
      equivalentLorries: SafeMath.round(orderBricks / 3500, 1),
      standardPackSize: '3,500 Bricks per Full Lorry Load',
      estimatedRateInr: 9.5,
      totalCostInr: SafeMath.round(orderBricks * 9.5, 2)
    });

    // 6. VITRIFIED FLOOR TILES (600x600mm)
    // 1 tile = 0.36 m² => ~2.78 tiles/m²; 4 tiles per box (1.44 m²/box)
    const tileBoxes = Math.ceil((totalFlooringM2 * 1.05) / 1.44);
    materials.push({
      materialCode: 'MAT-TIL-01',
      name: 'Vitrified Floor Tiles 600x600mm (2x2 ft)',
      category: 'Finishing',
      specification: 'Kajaria / Somany / Johnson Double Charged Glossy/Matte',
      theoreticalQuantity: SafeMath.round(totalFlooringM2, 1),
      wastagePercent: 5.0,
      orderQuantity: tileBoxes,
      unit: 'Boxes',
      equivalentTiles: tileBoxes * 4,
      standardPackSize: '4 Tiles per Box (1.44 m² / 15.5 sq.ft coverage)',
      estimatedRateInr: 680.0,
      totalCostInr: SafeMath.round(tileBoxes * 680, 2)
    });

    // 7. WALL PUTTY (40kg Bags)
    // Coverage ~1.2 kg/m² for 2 coats
    const puttyKg = totalPaintingM2 * 1.2;
    const puttyBags = Math.ceil(puttyKg / 40);
    materials.push({
      materialCode: 'MAT-PTY-01',
      name: 'Birla White / Asian Paints Wall Putty',
      category: 'Painting',
      specification: 'White cement-based water-resistant polymer putty',
      theoreticalQuantity: SafeMath.round(puttyKg, 1),
      wastagePercent: 2.0,
      orderQuantity: puttyBags,
      unit: 'Bags (40kg)',
      equivalentKg: puttyBags * 40,
      standardPackSize: '40 kg Moisture-Proof Bag',
      estimatedRateInr: 850.0,
      totalCostInr: SafeMath.round(puttyBags * 850, 2)
    });

    // 8. INTERIOR EMULSION PAINT (Litres)
    // Coverage ~10 m²/Litre for 2 coats
    const paintLitres = Math.ceil((totalPaintingM2 / 10) * 1.05);
    const paint20LBuckets = Math.ceil(paintLitres / 20);
    materials.push({
      materialCode: 'MAT-PNT-01',
      name: 'Premium Interior Acrylic Emulsion Paint',
      category: 'Painting',
      specification: 'Asian Paints Royale / Berger Silk Luxury Emulsion',
      theoreticalQuantity: SafeMath.round(totalPaintingM2 / 10, 1),
      wastagePercent: 5.0,
      orderQuantity: paint20LBuckets,
      unit: 'Buckets (20L)',
      equivalentLitres: paint20LBuckets * 20,
      standardPackSize: '20 Litre Plastic Drum',
      estimatedRateInr: 5400.0,
      totalCostInr: SafeMath.round(paint20LBuckets * 5400, 2)
    });

    return materials;
  }
}
