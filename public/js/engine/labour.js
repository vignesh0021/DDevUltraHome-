/**
 * Tamil Nadu Labour Productivity & Cost Estimation Engine
 * Based on Tamil Nadu PWD Standard Data Book and Market Contractor Output Rates
 */

import { SafeMath, Validator } from './math.js';

export const LABOUR_PRODUCTIVITY_NORMS = {
  // Man-days required per unit of work
  'EARTHWORK_EXCAVATION_M3': {
    unit: 'm³',
    description: 'Earthwork excavation in ordinary soil up to 1.5m depth',
    labour: { helper: 0.28 }
  },
  'PCC_M3': {
    unit: 'm³',
    description: 'PCC 1:4:8 mixing, pouring and compacting',
    labour: { mason: 0.10, helper: 0.85 }
  },
  'RCC_CONCRETE_M3': {
    unit: 'm³',
    description: 'RCC concrete placing and compacting (slabs/beams/columns)',
    labour: { mason: 0.25, helper: 1.40, vibratorOperator: 0.10 }
  },
  'STEEL_FABRICATION_KG': {
    unit: 'kg',
    description: 'Cutting, bending, and placing TMT rebar',
    labour: { barBender: 0.010, helper: 0.010 } // 1 bar bender + 1 helper per 100 kg
  },
  'FORMWORK_SHUTTERING_M2': {
    unit: 'm²',
    description: 'Erecting and dismantling centering/shuttering',
    labour: { carpenter: 0.28, helper: 0.28 }
  },
  'BRICK_MASONRY_M3': {
    unit: 'm³',
    description: 'Brickwork in 1:5 cement mortar',
    labour: { mason: 0.70, helper: 0.80 }
  },
  'PLASTERING_12MM_M2': {
    unit: 'm²',
    description: 'Internal cement plastering 12mm thick',
    labour: { mason: 0.11, helper: 0.14 } // ~90 sq.ft per pair per day
  },
  'FLOORING_TILES_M2': {
    unit: 'm²',
    description: 'Vitrified/ceramic tile laying with bedding mortar',
    labour: { tileMason: 0.14, helper: 0.14 }
  },
  'PAINTING_EMULSION_M2': {
    unit: 'm²',
    description: 'Surface preparation, primer + 2 coats emulsion',
    labour: { painter: 0.08, helper: 0.05 }
  }
};

export const DEFAULT_TN_LABOUR_RATES = {
  mason: { name: 'Civil Mason', ratePerDay: 1200, unit: 'day' },
  tileMason: { name: 'Specialist Tile Mason', ratePerDay: 1300, unit: 'day' },
  barBender: { name: 'Bar Bender (Steel Fitter)', ratePerDay: 1100, unit: 'day' },
  carpenter: { name: 'Shuttering Carpenter', ratePerDay: 1100, unit: 'day' },
  helper: { name: 'Construction Helper', ratePerDay: 850, unit: 'day' },
  vibratorOperator: { name: 'Equipment Operator', ratePerDay: 1000, unit: 'day' },
  painter: { name: 'Wall Painter', ratePerDay: 950, unit: 'day' },
  plumber: { name: 'Licensed Plumber', ratePerDay: 1050, unit: 'day' },
  electrician: { name: 'Wireman / Electrician', ratePerDay: 1100, unit: 'day' }
};

export class LabourEngine {
  /**
   * Estimate labour man-days and costs for a given activity
   * @param {Object} params
   * @param {string} params.activityKey - Key from LABOUR_PRODUCTIVITY_NORMS
   * @param {number} params.quantity - Quantity of work in corresponding unit
   * @param {Object} [params.customRates] - Optional overrides for daily wage rates
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const keyMap = {
      'RCC_WORK': 'RCC_CONCRETE_M3',
      'BRICK_WORK': 'BRICK_MASONRY_M3',
      'PLASTERING': 'PLASTERING_12MM_M2',
      'EXCAVATION': 'EARTHWORK_EXCAVATION_M3'
    };
    const rawKey = params.activityKey || params.activity;
    const resolvedKey = keyMap[rawKey] || rawKey;

    const norm = LABOUR_PRODUCTIVITY_NORMS[resolvedKey];
    if (!norm) {
      throw new Error(`Unknown labour activity key: ${rawKey}`);
    }

    const qCheck = Validator.positiveNumber('Work Quantity', params.quantity);
    if (!qCheck.valid) throw new Error(qCheck.error);
    const qty = qCheck.value;

    steps.push(`Activity: ${norm.description} (Quantity = ${qty} ${norm.unit})`);

    const rates = { ...DEFAULT_TN_LABOUR_RATES, ...(params.customRates || {}) };
    const breakdown = [];
    let totalLabourCost = 0;
    let totalManDays = 0;

    for (const [trade, factor] of Object.entries(norm.labour)) {
      const manDays = SafeMath.round(qty * factor, 2);
      const tradeInfo = rates[trade] || { name: trade, ratePerDay: 900 };
      const cost = SafeMath.round(manDays * tradeInfo.ratePerDay, 2);

      breakdown.push({
        trade,
        tradeName: tradeInfo.name,
        productivityFactor: factor,
        manDays,
        ratePerDay: tradeInfo.ratePerDay,
        totalCost: cost
      });

      totalManDays = SafeMath.round(totalManDays + manDays, 2);
      totalLabourCost = SafeMath.round(totalLabourCost + cost, 2);

      steps.push(`${tradeInfo.name}: ${qty} × ${factor} = ${manDays} man-days @ ₹${tradeInfo.ratePerDay}/day = ₹${cost.toLocaleString('en-IN')}`);
    }

    const masonDays = (breakdown.find(b => b.trade === 'mason' || b.trade === 'tileMason')?.manDays) || 0;
    const mazdoorDays = (breakdown.find(b => b.trade === 'barBender' || b.trade === 'carpenter')?.manDays) || 0;
    const helperDays = (breakdown.find(b => b.trade === 'helper')?.manDays) || 0;

    return {
      activity: resolvedKey,
      description: norm.description,
      quantity: qty,
      unit: norm.unit,
      totalManDays,
      totalLabourCost,
      masonDays,
      mazdoorDays,
      helperDays,
      breakdown,
      calculationSteps: steps,
      disclaimer: 'Labour output is based on standard 8-hour workday and normal site working conditions.'
    };
  }
}
