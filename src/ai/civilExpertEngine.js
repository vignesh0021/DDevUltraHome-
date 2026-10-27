/**
 * Deterministic Civil Engineering Expert Knowledge Engine
 * 100% Offline, Rule-Based, and Compliant with IS 456, IS 1200, IS 2502 & TN PWD Norms
 * Provides verified answers and formulas without numerical fabrication
 */

import { SafeMath, UnitConverter } from '../engine/math.js';
import { CONCRETE_MIX_PROPORTIONS, ConcreteEngine } from '../engine/concrete.js';
import { BbsEngine } from '../engine/bbs.js';
import { MaterialPriceIntelligence } from '../intelligence/materialRates.js';
import { ScrapRatesEngine } from '../intelligence/scrapRates.js';

export class CivilExpertEngine {
  /**
   * Process a civil engineering user question and return a structured expert response
   * @param {string} query
   * @param {Object} [context]
   */
  static answer(query, context = {}) {
    const q = (query || '').toLowerCase().trim();

    if (!q) {
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Civil Knowledge Engine (Offline Rule-Based)',
        answer: 'Please enter a civil engineering question, material query, or calculation request (e.g., "M20 concrete mix ratio", "bar bending deductions", "Tamil Nadu ground to cent conversion", "current cement rate in Chennai").',
        references: ['IS 456:2000', 'TN PWD SOR 2025-26']
      };
    }

    // 1. Concrete Mix & Grades
    if (q.includes('mix') || q.includes('grade') || q.includes('m20') || q.includes('m25') || q.includes('m15') || q.includes('m10')) {
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Civil Knowledge Engine (IS 456 Reference)',
        topic: 'Concrete Mix Proportions',
        answer: `Standard Nominal Concrete Mixes (IS 456:2000 Table 9):
• M7.5: 1 : 4 : 8 (Foundation PCC / Bedding)
• M10: 1 : 3 : 6 (Plain Cement Concrete)
• M15: 1 : 2 : 4 (Flooring bed / Pathways)
• M20: 1 : 1.5 : 3 (General Residential RCC - Slabs, Beams, Columns)
• M25: 1 : 1 : 2 (Heavy RCC - Footings, Water Retaining Structures)

Key Constants:
• Dry Volume Factor = 1.54 (Concrete shrinks by ~54% when water is added to dry cement, sand, and aggregate).
• 1 Cement Bag = 50 kg = 0.0347 m³ = 1.226 cft.
• Bulk density of cement = 1440 kg/m³.`,
        references: ['IS 456:2000 Clause 9.3', 'IS 10262 Concrete Mix Proportioning']
      };
    }

    // 2. Bar Bending & BBS
    if (q.includes('bbs') || q.includes('bar bending') || q.includes('bend') || q.includes('rebar') || q.includes('steel weight') || q.includes('stirrup')) {
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Civil Knowledge Engine (IS 2502 Reference)',
        topic: 'Bar Bending Schedule (BBS) Standards',
        answer: `Bar Bending Schedule Rules (IS 2502:1963 & SP 34):
1. Unit Weight Formula: Weight (kg/m) = d² / 162.28 (where d is bar diameter in mm).
   • 8mm = 0.395 kg/m
   • 10mm = 0.617 kg/m
   • 12mm = 0.888 kg/m
   • 16mm = 1.580 kg/m
   • 20mm = 2.470 kg/m
   • 25mm = 3.850 kg/m

2. Bend Deductions:
   • 45° bend = 1d
   • 90° bend = 2d
   • 135° bend = 3d
   • 180° hook = 4d

3. Stirrup Hooks:
   • Standard seismic ties require two 135° hooks with length 10d (minimum 75mm) per IS 13920.`,
        references: ['IS 2502:1963', 'IS 13920:2016 (Ductile Detailing)']
      };
    }

    // 3. Tamil Nadu Land & Unit Conversions
    if (q.includes('ground') || q.includes('cent') || q.includes('unit') || q.includes('cft') || q.includes('acre') || q.includes('ankanam')) {
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Civil Knowledge Engine (Tamil Nadu Standards)',
        topic: 'Tamil Nadu Land & Material Units',
        answer: `Tamil Nadu Civil & Real Estate Measurement Constants:
• 1 Ground = 2,400 sq.ft = 222.97 sq.m (Common Chennai plot benchmark)
• 1 Cent = 435.6 sq.ft = 40.47 sq.m
• 1 Acre = 100 Cents = 43,560 sq.ft = 18.15 Grounds
• 1 Ankanam = 72 sq.ft = 6.69 sq.m
• 1 Guntha = 1,089 sq.ft = 2.5 Cents
• 1 TN Unit (Brass) of Sand / Blue Metal = 100 cft (Cu.Ft) ≈ 2.83 m³ ≈ 4.5 Tonnes M-Sand
• 1 m³ = 35.315 cft = 1,000 Litres water`,
        references: ['Tamil Nadu Land Records Act', 'TN PWD Standard Data Book']
      };
    }

    // 4. Curing & Deshuttering
    if (q.includes('curing') || q.includes('striking') || q.includes('deshuttering') || q.includes('formwork period')) {
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Civil Knowledge Engine (IS 456 Standards)',
        topic: 'Curing & Formwork Striking Times',
        answer: `Curing Requirements (IS 456 Clause 13.5):
• OPC Cement: Minimum 7 days continuous wet curing.
• PPC / Slag Cement / Mineral Admixtures: Minimum 10 days (14 days recommended in hot/dry climate).

Minimum Deshuttering Periods (IS 456 Table 11):
• Vertical faces of walls, columns, beam sides: 16 to 24 hours.
• Slab soffit formwork (props left under): 3 days (spans up to 4.5m) to 7 days.
• Beam soffits (props left under): 7 days.
• Removal of props under slabs: Spans up to 4.5m = 7 days; Spans > 4.5m = 14 days.
• Removal of props under beams and arches: Spans up to 6m = 14 days; Spans > 6m = 21 days.`,
        references: ['IS 456:2000 Table 11 & Clause 13.5']
      };
    }

    // 5. Material Prices
    if (q.includes('cement price') || q.includes('steel price') || q.includes('sand price') || q.includes('pwd rate') || q.includes('rate in chennai')) {
      const rates = MaterialPriceIntelligence.getRatesForDistrict('Chennai');
      const sample = rates.slice(0, 5).map(r => `• ${r.standardName}: Market ₹${r.marketPrice}/${r.unit} (Official PWD SOR: ₹${r.officialSorPrice}/${r.unit})`).join('\n');
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Material Intelligence (TN PWD SOR 2025-26 & Market Index)',
        topic: 'Current Chennai Construction Rates',
        answer: `Current Reference Rates in Chennai:\n${sample}\n\nNote: Basic PWD SOR rates exclude 18% GST. Market retail includes dealer transport within service radius.`,
        references: ['TN PWD Schedule of Rates 2025-26 Vol-I (Effective 22-July-2025)']
      };
    }

    // 6. Scrap Rates
    if (q.includes('scrap') || q.includes('copper rate') || q.includes('iron scrap') || q.includes('battery scrap') || q.includes('brass scrap')) {
      const scraps = ScrapRatesEngine.getAllRates().slice(0, 5).map(s => `• ${s.name}: ₹${s.indicativeRate}/${s.unit} (${s.source})`).join('\n');
      return {
        isAiGenerated: false,
        source: 'DDevUltraHome Scrap Intelligence (LiveChennai & Scraprates.in)',
        topic: 'Current Tamil Nadu Scrap Rates',
        answer: `Current Indicative Scrap Benchmarks in Chennai:\n${scraps}\n\nNote: Net settlement requires deductions for moisture, dirt, and wire sheath insulation.`,
        references: ['LiveChennai Scrap Market Index', 'Scraprates.in Tamil Nadu']
      };
    }

    // Default Civil Engineering Guidance
    return {
      isAiGenerated: false,
      source: 'DDevUltraHome Civil Knowledge Engine',
      topic: 'Civil Engineering Assistance',
      answer: `I can assist you with deterministic civil engineering calculations, standard codes, and Tamil Nadu cost estimation:
• Concrete mix designs (M7.5 to M30, cement bags, sand, aggregate, water).
• RCC structural elements (Slab, Beam, Column, Footing, Staircase).
• Masonry (Traditional wire-cut 9"x4.25"x2.75", Fly-ash, AAC blocks).
• Bar Bending Schedule (BBS) cutting lengths, weights (d²/162), and bend deductions.
• Finishing works (Plastering, Painting, Vitrified tiles).
• Earthwork excavation, bulking (1.25), and backfilling.
• Tamil Nadu unit conversions (Ground, Cent, Acre, Unit of Sand).
• TN PWD Schedule of Rates 2025-26 and Chennai Scrap market benchmarks.`,
      references: ['IS 456:2000', 'IS 1200', 'IS 2502', 'TN PWD SOR 2025-26']
    };
  }
}
