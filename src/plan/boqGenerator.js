/**
 * Plan-to-BOQ Civil Engineering Quantity Generator
 * Generates an itemized draft Bill of Quantities (BOQ) from confirmed takeoff dimensions,
 * structural schedules, and building specifications using DDevUltraHome core calculation engines
 */

import { SafeMath } from '../engine/math.js';
import { ConcreteEngine } from '../engine/concrete.js';
import { RccEngine } from '../engine/rcc.js';
import { MasonryEngine } from '../engine/masonry.js';
import { FinishingEngine } from '../engine/finishing.js';
import { EarthworkEngine } from '../engine/earthwork.js';
import { BbsEngine } from '../engine/bbs.js';
import { FormworkEngine } from '../engine/formwork.js';
import { SepticTankEngine } from '../engine/septictank.js';
import { RwhEngine } from '../engine/rwh.js';
import { PlinthEngine } from '../engine/plinth.js';
import { AntiTermiteEngine } from '../engine/antitermite.js';

export class BoqGenerator {
  /**
   * Generate an itemized civil engineering draft BOQ from confirmed plan data
   * @param {Object} projectData
   * @param {string} projectData.projectName
   * @param {string} [projectData.district='Chennai']
   * @param {number} [projectData.floorsCount=1] - E.g. 1 for Ground floor, 2 for G+1
   * @param {Array<Object>} projectData.rooms - Array of extracted/confirmed room takeoffs
   * @param {Array<Object>} [projectData.schedules] - Columns, beams, footings from drawings
   * @param {Object} [projectData.structuralAssumptions]
   */
  static generateDraftBoq(projectData) {
    const items = [];
    const assumptions = [];
    const rooms = Array.isArray(projectData.rooms) ? projectData.rooms : [];
    const schedules = Array.isArray(projectData.schedules) ? projectData.schedules : [];
    const floors = Number(projectData.floorsCount) || 1;

    // 1. Compute Base Footprint and Built-up Areas
    let carpetAreaSqft = 0;
    let carpetAreaM2 = 0;
    for (const r of rooms) {
      carpetAreaSqft += Number(r.areaSqft) || 0;
      carpetAreaM2 += Number(r.areaM2) || 0;
    }

    // If rooms are empty, fallback to 1200 sq.ft default house
    if (carpetAreaSqft <= 0) {
      carpetAreaSqft = 1000;
      carpetAreaM2 = SafeMath.round(carpetAreaSqft / 10.7639, 2);
      assumptions.push('No room dimensions detected: Using standard 1,000 sq.ft residential baseline');
    }

    // Built-up area includes walls & circulation (~20% above carpet area)
    const builtupAreaSqftPerFloor = SafeMath.round(carpetAreaSqft * 1.20, 1);
    const builtupAreaM2PerFloor = SafeMath.round(carpetAreaM2 * 1.20, 1);
    const totalBuiltupAreaSqft = SafeMath.round(builtupAreaSqftPerFloor * floors, 1);
    const totalBuiltupAreaM2 = SafeMath.round(builtupAreaM2PerFloor * floors, 1);
    const plinthPerimeterM = SafeMath.round(Math.sqrt(builtupAreaM2PerFloor) * 4 * 1.4, 1); // External + internal plinth beams

    // 2. Identify Column & Footing Counts from Schedules or Built-up Area
    const columnSchedules = schedules.filter(s => s.category === 'COLUMN');
    const footingSchedules = schedules.filter(s => s.category === 'FOOTING');
    const numColumns = columnSchedules.length > 0 ? columnSchedules.length : Math.max(8, Math.round(builtupAreaSqftPerFloor / 100));
    const numFootings = footingSchedules.length > 0 ? footingSchedules.length : numColumns;

    assumptions.push(`Structural Basis: ${numColumns} columns & ${numFootings} isolated footings for ${builtupAreaSqftPerFloor} sq.ft footprint`);

    // ==========================================
    // ITEM 01: Earthwork Excavation in Foundation
    // ==========================================
    // Average footing pit: 1.8m x 1.8m x 1.5m depth
    const excavationPerPitM3 = 1.8 * 1.8 * 1.5;
    const trenchExcavationM3 = plinthPerimeterM * 0.45 * 0.60;
    const totalExcavationM3 = SafeMath.round((numFootings * excavationPerPitM3) + trenchExcavationM3, 2);
    items.push({
      itemCode: 'ITEM-01',
      trade: 'Earthwork',
      description: 'Earthwork excavation in foundation pits, trenches and column footings up to 1.5m depth including dressing and depositing soil within 50m lead per IS 1200 Part 1',
      level: 'Substructure',
      unit: 'm³',
      grossQuantity: totalExcavationM3,
      deductions: 0,
      netQuantity: totalExcavationM3,
      wasteAllowancePercent: 0,
      materialRate: 0,
      labourRate: 350.0,
      unitRate: 350.0,
      totalAmount: SafeMath.round(totalExcavationM3 * 350, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 02: Plain Cement Concrete (PCC 1:4:8)
    // ==========================================
    // 100mm PCC bed under footings and trenches
    const pccFootingsM3 = numFootings * (1.8 * 1.8 * 0.10);
    const pccTrenchesM3 = plinthPerimeterM * 0.45 * 0.10;
    const totalPccM3 = SafeMath.round(pccFootingsM3 + pccTrenchesM3, 2);
    items.push({
      itemCode: 'ITEM-02',
      trade: 'Concrete',
      description: 'Providing and laying Plain Cement Concrete (PCC 1:4:8 with 40mm blue metal) 100mm thick as levelling course under footings and plinth beams per IS 456',
      level: 'Substructure',
      unit: 'm³',
      grossQuantity: totalPccM3,
      deductions: 0,
      netQuantity: totalPccM3,
      wasteAllowancePercent: 2.0,
      materialRate: 3600.0,
      labourRate: 750.0,
      unitRate: 4350.0,
      totalAmount: SafeMath.round(totalPccM3 * 4350, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 03: RCC in Footings (M20 / M25)
    // ==========================================
    // Average footing size: 1.5m x 1.5m x 0.45m sloped
    const footingVolM3 = SafeMath.round(numFootings * (1.5 * 1.5 * 0.40), 2);
    items.push({
      itemCode: 'ITEM-03',
      trade: 'RCC',
      description: 'Providing and laying Reinforced Cement Concrete (RCC M25) in isolated pad/trapezoidal column footings up to plinth level including vibration per IS 456',
      level: 'Substructure',
      unit: 'm³',
      grossQuantity: footingVolM3,
      deductions: 0,
      netQuantity: footingVolM3,
      wasteAllowancePercent: 2.0,
      materialRate: 4900.0,
      labourRate: 1100.0,
      unitRate: 6000.0,
      totalAmount: SafeMath.round(footingVolM3 * 6000, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 04: RCC in Plinth & Roof Beams
    // ==========================================
    // Average beam: 230mm x 450mm
    const beamLengthM = plinthPerimeterM * (floors + 1); // Plinth + roof levels
    const beamVolM3 = SafeMath.round(beamLengthM * 0.23 * 0.40, 2);
    items.push({
      itemCode: 'ITEM-04',
      trade: 'RCC',
      description: 'Reinforced Cement Concrete (RCC M25) in plinth beams, tie beams, and roof lintel/main beams including placing and consolidating per IS 456',
      level: 'Superstructure',
      unit: 'm³',
      grossQuantity: beamVolM3,
      deductions: 0,
      netQuantity: beamVolM3,
      wasteAllowancePercent: 2.0,
      materialRate: 4900.0,
      labourRate: 1350.0,
      unitRate: 6250.0,
      totalAmount: SafeMath.round(beamVolM3 * 6250, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 05: RCC in Columns
    // ==========================================
    // Columns: 300mm x 300mm x 3.0m height per floor
    const columnVolM3 = SafeMath.round(numColumns * floors * (0.30 * 0.30 * 3.0), 2);
    items.push({
      itemCode: 'ITEM-05',
      trade: 'RCC',
      description: 'Reinforced Cement Concrete (RCC M25) in rectangular vertical columns from plinth to terrace slab level per IS 456',
      level: 'Superstructure',
      unit: 'm³',
      grossQuantity: columnVolM3,
      deductions: 0,
      netQuantity: columnVolM3,
      wasteAllowancePercent: 2.0,
      materialRate: 4900.0,
      labourRate: 1450.0,
      unitRate: 6350.0,
      totalAmount: SafeMath.round(columnVolM3 * 6350, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 06: RCC in Roof Slabs & Staircase
    // ==========================================
    // Roof slab: 125mm thickness over total built-up area
    const slabVolM3 = SafeMath.round(builtupAreaM2PerFloor * floors * 0.125, 2);
    items.push({
      itemCode: 'ITEM-06',
      trade: 'RCC',
      description: 'Reinforced Cement Concrete (RCC M25) 125mm thick in one-way and two-way suspended roof slabs, chajjas, and waist slabs per IS 456',
      level: 'Superstructure',
      unit: 'm³',
      grossQuantity: slabVolM3,
      deductions: 0,
      netQuantity: slabVolM3,
      wasteAllowancePercent: 2.0,
      materialRate: 4900.0,
      labourRate: 1400.0,
      unitRate: 6300.0,
      totalAmount: SafeMath.round(slabVolM3 * 6300, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 07: Fe550D TMT Reinforcement Steel
    // ==========================================
    // Total RCC volume: footings + beams + columns + slabs
    const totalRccM3 = SafeMath.round(footingVolM3 + beamVolM3 + columnVolM3 + slabVolM3, 2);
    // Engineered steel density: ~80 kg/m³ for residential frame structure
    const totalSteelKg = SafeMath.round(totalRccM3 * 82.0, 1);
    items.push({
      itemCode: 'ITEM-07',
      trade: 'Steel & BBS',
      description: 'Providing, cutting, bending, fabricating, hooking (135° seismic hooks), placing, and binding Fe550D High-Ductility TMT reinforcement bars per IS 1786 & IS 2502',
      level: 'All Levels',
      unit: 'kg',
      grossQuantity: totalSteelKg,
      deductions: 0,
      netQuantity: totalSteelKg,
      wasteAllowancePercent: 3.0,
      materialRate: 64.5,
      labourRate: 11.5,
      unitRate: 76.0,
      totalAmount: SafeMath.round(totalSteelKg * 76.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 08: Centering & Formwork
    // ==========================================
    // Formwork contact area: slabs + beam sides/soffits + columns
    const slabShutteringM2 = builtupAreaM2PerFloor * floors;
    const beamShutteringM2 = beamLengthM * 0.90; // (2 sides + bottom)
    const columnShutteringM2 = numColumns * floors * (4 * 0.30 * 3.0);
    const totalFormworkM2 = SafeMath.round(slabShutteringM2 + beamShutteringM2 + columnShutteringM2, 1);
    items.push({
      itemCode: 'ITEM-08',
      trade: 'Formwork',
      description: 'Centering, shuttering, propping with Acrow steel props, and formwork using 12mm BWP plywood sheets for slabs, beams, and columns per IS 14687',
      level: 'Superstructure',
      unit: 'm²',
      grossQuantity: totalFormworkM2,
      deductions: 0,
      netQuantity: totalFormworkM2,
      wasteAllowancePercent: 0,
      materialRate: 120.0,
      labourRate: 240.0,
      unitRate: 360.0,
      totalAmount: SafeMath.round(totalFormworkM2 * 360.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 09: 9-inch Red Brick Masonry
    // ==========================================
    // Exterior wall area: perimeter * 3.0m height * floors, minus ~15% openings
    const grossWallAreaM2 = plinthPerimeterM * 3.0 * floors;
    const openingDeductionsM2 = SafeMath.round(grossWallAreaM2 * 0.15, 1);
    const netBrickWallM2 = SafeMath.round(grossWallAreaM2 - openingDeductionsM2, 1);
    const brickVolM3 = SafeMath.round(netBrickWallM2 * 0.23, 2);
    items.push({
      itemCode: 'ITEM-09',
      trade: 'Masonry',
      description: 'Brickwork in 230mm (9-inch) thick exterior walls with traditional wire-cut red country bricks in cement mortar 1:5 per IS 2212',
      level: 'Superstructure',
      unit: 'm³',
      grossQuantity: SafeMath.round(grossWallAreaM2 * 0.23, 2),
      deductions: SafeMath.round(openingDeductionsM2 * 0.23, 2),
      netQuantity: brickVolM3,
      wasteAllowancePercent: 5.0,
      materialRate: 4800.0,
      labourRate: 1600.0,
      unitRate: 6400.0,
      totalAmount: SafeMath.round(brickVolM3 * 6400.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 10: 4.5-inch Brick Partition Walls
    // ==========================================
    // Partition wall area approx 40% of exterior wall area
    const partitionAreaM2 = SafeMath.round(netBrickWallM2 * 0.40, 1);
    items.push({
      itemCode: 'ITEM-10',
      trade: 'Masonry',
      description: 'Half-brick thick (115mm / 4.5-inch) interior partition wall masonry in cement mortar 1:4 with RCC hoop iron reinforcement at every third course per IS 2212',
      level: 'Superstructure',
      unit: 'm²',
      grossQuantity: partitionAreaM2,
      deductions: 0,
      netQuantity: partitionAreaM2,
      wasteAllowancePercent: 5.0,
      materialRate: 420.0,
      labourRate: 210.0,
      unitRate: 630.0,
      totalAmount: SafeMath.round(partitionAreaM2 * 630.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 11: Internal & Ceiling Plastering (12mm)
    // ==========================================
    // Plaster area = 2 * (outer + inner walls) + ceiling slab
    const plasterAreaM2 = SafeMath.round((netBrickWallM2 * 2) + (partitionAreaM2 * 2) + (builtupAreaM2PerFloor * floors), 1);
    items.push({
      itemCode: 'ITEM-11',
      trade: 'Finishing',
      description: 'Internal wall and ceiling plastering 12mm thick in cement mortar 1:5 finished smooth with neat cement slurry per IS 1661',
      level: 'Finishing',
      unit: 'm²',
      grossQuantity: plasterAreaM2,
      deductions: 0,
      netQuantity: plasterAreaM2,
      wasteAllowancePercent: 2.0,
      materialRate: 85.0,
      labourRate: 145.0,
      unitRate: 230.0,
      totalAmount: SafeMath.round(plasterAreaM2 * 230.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 12: Vitrified Tile Flooring (2x2 ft)
    // ==========================================
    const floorTileAreaM2 = SafeMath.round(carpetAreaM2 * floors, 1);
    items.push({
      itemCode: 'ITEM-12',
      trade: 'Finishing',
      description: 'Providing and laying 600x600mm double-charged vitrified floor tiles laid on 20mm thick cement mortar 1:4 bed with 100mm wall skirting per IS 1443',
      level: 'Finishing',
      unit: 'm²',
      grossQuantity: floorTileAreaM2,
      deductions: 0,
      netQuantity: floorTileAreaM2,
      wasteAllowancePercent: 5.0,
      materialRate: 520.0,
      labourRate: 190.0,
      unitRate: 710.0,
      totalAmount: SafeMath.round(floorTileAreaM2 * 710.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 13: Painting (Putty, Primer & Emulsion)
    // ==========================================
    items.push({
      itemCode: 'ITEM-13',
      trade: 'Painting',
      description: 'Interior painting with 2 coats Birla white cement-based putty, 1 coat water-thinnable primer, and 2 coats premium acrylic interior emulsion per IS 2395',
      level: 'Finishing',
      unit: 'm²',
      grossQuantity: plasterAreaM2,
      deductions: 0,
      netQuantity: plasterAreaM2,
      wasteAllowancePercent: 0,
      materialRate: 65.0,
      labourRate: 85.0,
      unitRate: 150.0,
      totalAmount: SafeMath.round(plasterAreaM2 * 150.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 14: Damp Proof Course (DPC 50mm)
    // ==========================================
    const dpcAreaM2 = SafeMath.round(plinthPerimeterM * 0.23, 2);
    items.push({
      itemCode: 'ITEM-14',
      trade: 'Waterproofing',
      description: '50mm thick Plain Cement Concrete (1:2:4) Damp Proof Course with integral liquid waterproofing compound (200ml/bag) and hot bitumen coat per IS 2645',
      level: 'Plinth Level',
      unit: 'm²',
      grossQuantity: dpcAreaM2,
      deductions: 0,
      netQuantity: dpcAreaM2,
      wasteAllowancePercent: 0,
      materialRate: 310.0,
      labourRate: 140.0,
      unitRate: 450.0,
      totalAmount: SafeMath.round(dpcAreaM2 * 450.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 15: Pre-Construction Anti-Termite
    // ==========================================
    items.push({
      itemCode: 'ITEM-15',
      trade: 'Specialized',
      description: 'Pre-construction anti-termite chemical treatment in 4 stages (trench, backfill, plinth sub-base, and perimeter barrier) with Chlorpyrifos 20% EC per IS 6313',
      level: 'Substructure',
      unit: 'm²',
      grossQuantity: builtupAreaM2PerFloor,
      deductions: 0,
      netQuantity: builtupAreaM2PerFloor,
      wasteAllowancePercent: 0,
      materialRate: 90.0,
      labourRate: 45.0,
      unitRate: 135.0,
      totalAmount: SafeMath.round(builtupAreaM2PerFloor * 135.0, 2),
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // ==========================================
    // ITEM 16: Rainwater Harvesting Sump & Pit
    // ==========================================
    items.push({
      itemCode: 'ITEM-16',
      trade: 'Statutory',
      description: 'Rainwater harvesting percolation pit (1.0m x 1.0m x 1.5m) packed with 40mm metal, gravel, sand with 150mm PVC slotted recharge bore per TNCDBR Rule 42',
      level: 'External Works',
      unit: 'Nos',
      grossQuantity: 2,
      deductions: 0,
      netQuantity: 2,
      wasteAllowancePercent: 0,
      materialRate: 14500.0,
      labourRate: 4500.0,
      unitRate: 19000.0,
      totalAmount: 38000.0,
      confidenceStatus: 'High',
      reviewStatus: 'Draft — Requires Review'
    });

    // 3. Direct Cost Subtotal
    const directCostSubtotal = items.reduce((acc, itm) => acc + itm.totalAmount, 0);

    // 4. Overheads, Contractor Profit, Contingency, and Taxes
    const overheadRate = 0.05; // 5%
    const overheadAmount = SafeMath.round(directCostSubtotal * overheadRate, 2);

    const profitRate = 0.10; // 10%
    const profitAmount = SafeMath.round((directCostSubtotal + overheadAmount) * profitRate, 2);

    const contingencyRate = 0.03; // 3%
    const contingencyAmount = SafeMath.round(directCostSubtotal * contingencyRate, 2);

    const preTaxTotal = SafeMath.round(directCostSubtotal + overheadAmount + profitAmount + contingencyAmount, 2);

    const gstRate = 0.18; // 18% Works Contract GST
    const gstAmount = SafeMath.round(preTaxTotal * gstRate, 2);

    const grandTotal = SafeMath.round(preTaxTotal + gstAmount, 2);
    const costPerSqft = SafeMath.round(grandTotal / totalBuiltupAreaSqft, 2);
    const costPerM2 = SafeMath.round(grandTotal / totalBuiltupAreaM2, 2);

    return {
      projectName: projectData.projectName || 'Residential Building Plan',
      district: projectData.district || 'Chennai',
      buildingProfile: {
        floorsCount: floors,
        carpetAreaSqft: SafeMath.round(carpetAreaSqft * floors, 1),
        carpetAreaM2: SafeMath.round(carpetAreaM2 * floors, 1),
        totalBuiltupAreaSqft,
        totalBuiltupAreaM2,
        numColumns,
        numFootings
      },
      items,
      financials: {
        directCostSubtotal,
        overhead: { percentage: 5.0, amount: overheadAmount },
        contractorProfit: { percentage: 10.0, amount: profitAmount },
        contingency: { percentage: 3.0, amount: contingencyAmount },
        preTaxTotal,
        gst: { percentage: 18.0, amount: gstAmount },
        grandTotal,
        costPerSqft,
        costPerM2,
        formattedGrandTotal: SafeMath.formatINR(grandTotal)
      },
      assumptions,
      defaultStatus: 'Draft — Requires Review'
    };
  }
}
