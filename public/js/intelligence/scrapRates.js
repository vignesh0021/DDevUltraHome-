/**
 * Tamil Nadu Scrap Pricing Intelligence Module
 * Benchmark data verified from LiveChennai (Chennai Scrap Market) and Scraprates.in (Tamil Nadu State)
 */

import { SafeMath } from '../engine/math.js';

export const SCRAP_CATEGORIES = [
  'Ferrous Metals',
  'Non-Ferrous Metals',
  'Batteries & Lead',
  'Electrical & Cables',
  'Machinery & Appliances',
  'Paper & Plastic'
];

export const SCRAP_RATE_BENCHMARKS = [
  // 1. Non-Ferrous: Copper & Brass
  {
    id: 'SCRAP-COP-DC',
    category: 'Non-Ferrous Metals',
    name: 'Copper DC (Armature / Heavy Bright Wire)',
    grade: 'Grade 1 (99% Pure Unalloyed)',
    unit: 'kg',
    indicativeRate: 950.00,
    rangeMin: 920.00,
    rangeMax: 980.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Clean stripped bright copper wire, zero tinning or solder.'
  },
  {
    id: 'SCRAP-COP-OC',
    category: 'Non-Ferrous Metals',
    name: 'Copper OC (Mixed / Burnt Copper)',
    grade: 'Grade 2 (Commercial mixed)',
    unit: 'kg',
    indicativeRate: 850.00,
    rangeMin: 810.00,
    rangeMax: 870.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Secondary copper, motor windings with mild enamel, or burnt wire.'
  },
  {
    id: 'SCRAP-BRASS-HONEY',
    category: 'Non-Ferrous Metals',
    name: 'Brass (Honey / Turning / Plumbing Fixtures)',
    grade: 'Yellow Brass (60/40 Cu-Zn)',
    unit: 'kg',
    indicativeRate: 700.00,
    rangeMin: 650.00,
    rangeMax: 720.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Solid brass valves, pipe fittings, ornamental brassware.'
  },
  {
    id: 'SCRAP-ALUM-SECTION',
    category: 'Non-Ferrous Metals',
    name: 'Aluminium Section (Door/Window Architectural Extrusion)',
    grade: '6063 Alloy Extrusion',
    unit: 'kg',
    indicativeRate: 350.00,
    rangeMin: 320.00,
    rangeMax: 360.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Anodized or mill finish window/partition profiles, free of iron brackets/screws.'
  },
  {
    id: 'SCRAP-ALUM-UTENSIL',
    category: 'Non-Ferrous Metals',
    name: 'Aluminium Utensil / Sheet Scrap',
    grade: 'Commercial Grade',
    unit: 'kg',
    indicativeRate: 153.40,
    rangeMin: 144.00,
    rangeMax: 168.00,
    source: 'Scraprates.in Tamil Nadu Market Index',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Domestic pots, pans, cookware, light alloy sheets.'
  },

  // 2. Ferrous: Iron & Steel
  {
    id: 'SCRAP-IRON-HMS',
    category: 'Ferrous Metals',
    name: 'Iron / Heavy Melting Steel (HMS 1 & 2)',
    grade: 'Structural Steel / Cut Rebar / Heavy Plates',
    unit: 'kg',
    indicativeRate: 41.00,
    rangeMin: 38.00,
    rangeMax: 43.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Thick scrap > 6mm, rebar offcuts, I-beams, machinery frames.'
  },
  {
    id: 'SCRAP-IRON-CAST',
    category: 'Ferrous Metals',
    name: 'Cast Iron (Machinery & Pipe Scrap)',
    grade: 'CI Scrap (Pumps, motors, manhole covers)',
    unit: 'kg',
    indicativeRate: 36.50,
    rangeMin: 34.00,
    rangeMax: 39.00,
    source: 'Tamil Nadu Dealer Quotations',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Brittle gray cast iron, automotive engine blocks, CI drainage pipes.'
  },
  {
    id: 'SCRAP-SS-304',
    category: 'Ferrous Metals',
    name: 'Stainless Steel SS 304',
    grade: '18/8 Austenitic SS (Non-magnetic)',
    unit: 'kg',
    indicativeRate: 140.00,
    rangeMin: 130.00,
    rangeMax: 155.00,
    source: 'Tamil Nadu Stainless Steel Scrap Index',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Non-magnetic kitchen sinks, handrails, food processing scrap.'
  },

  // 3. Electrical & Cables
  {
    id: 'SCRAP-CABLE-ELEC',
    category: 'Electrical & Cables',
    name: 'Electrical Wire with PVC Insulation (House Wire)',
    grade: 'Copper Content ~40-45%',
    unit: 'kg',
    indicativeRate: 170.00,
    rangeMin: 160.00,
    rangeMax: 185.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Unstripped domestic wiring, 1.5mm / 2.5mm / 4mm copper cables with PVC sheath.'
  },
  {
    id: 'SCRAP-CABLE-GRAY',
    category: 'Electrical & Cables',
    name: 'Gray Industrial Armoured Cable',
    grade: 'Multi-core copper with lead/steel armouring',
    unit: 'kg',
    indicativeRate: 350.00,
    rangeMin: 330.00,
    rangeMax: 380.00,
    source: 'LiveChennai Scrap Prices Market Report',
    sourceUrl: 'https://www.livechennai.com/scrap_prices_Chennai.asp',
    observedDate: '2026-10-26',
    notes: 'Thick feeder cables with higher copper recovery factor.'
  },

  // 4. Batteries & Machinery
  {
    id: 'SCRAP-BAT-CAR',
    category: 'Batteries & Lead',
    name: 'Car / Inverter Lead-Acid Battery',
    grade: 'Lead-Acid (With dry/wet acid condition)',
    unit: 'kg',
    indicativeRate: 66.66,
    rangeMin: 61.20,
    rangeMax: 71.65,
    source: 'Scraprates.in Tamil Nadu Market Index',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Intact casing required without leakage. Recycled by certified smelters.'
  },
  {
    id: 'SCRAP-AC-COMPRESSOR',
    category: 'Machinery & Appliances',
    name: 'AC Compressor (Rotary / Reciprocating)',
    grade: 'Hermetic unit with copper windings',
    unit: 'kg',
    indicativeRate: 106.70,
    rangeMin: 100.00,
    rangeMax: 115.50,
    source: 'Scraprates.in Tamil Nadu Market Index',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Old split/window air conditioner compressors (oil drained).'
  },
  {
    id: 'SCRAP-E-WASTE',
    category: 'Machinery & Appliances',
    name: 'E-Waste (Computer boards, motherboards, UPS)',
    grade: 'PCB / Electronic Scrap',
    unit: 'kg',
    indicativeRate: 43.00,
    rangeMin: 40.00,
    rangeMax: 47.50,
    source: 'Scraprates.in Tamil Nadu Market Index',
    sourceUrl: 'https://scraprates.in/state/tamil-nadu',
    observedDate: '2026-10-25',
    notes: 'Electronic scrap for precious metal extraction and component recovery.'
  }
];

export class ScrapRatesEngine {
  static getAllRates() {
    return SCRAP_RATE_BENCHMARKS.map(item => ({
      ...item,
      formattedRate: SafeMath.formatINR(item.indicativeRate)
    }));
  }

  static getRateById(id) {
    return SCRAP_RATE_BENCHMARKS.find(item => item.id === id) || null;
  }

  static getRatesByCategory(category) {
    return SCRAP_RATE_BENCHMARKS.filter(item => item.category === category);
  }
}
