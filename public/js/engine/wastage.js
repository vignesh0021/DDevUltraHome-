/**
 * Civil Construction Material Wastage Engine
 * Tamil Nadu Standard Site Construction Norms
 */

import { SafeMath } from './math.js';

export const STANDARD_WASTAGE_PERCENTAGES = {
  steel: { default: 4, min: 2, max: 7, description: 'Cutting off-cuts, end trimmings, lap splices' },
  cement: { default: 2.5, min: 1, max: 5, description: 'Handling, bag retention, dusting during mixing' },
  sand: { default: 8, min: 5, max: 12, description: 'Stacking loss, wind erosion, transit settlement, rebound' },
  aggregate: { default: 6, min: 4, max: 10, description: 'Subgrade sinking, spreading and compaction loss' },
  bricks: { default: 5, min: 3, max: 8, description: 'Transit breakage, bat cutting for closers and bonds' },
  aacBlocks: { default: 4, min: 2, max: 6, description: 'Sawing breakage, edge chipping' },
  tiles: { default: 7, min: 5, max: 10, description: 'Corner cuts, pipe cutouts, diagonal layout cuts' },
  paint: { default: 5, min: 3, max: 8, description: 'Roller residue, tray drying, brush spillage' }
};

export class WastageEngine {
  static getWastage(materialKey) {
    return STANDARD_WASTAGE_PERCENTAGES[materialKey] || { default: 5, min: 1, max: 15, description: 'General material allowance' };
  }

  static applyWastage(netQuantity, wastagePercent) {
    const qty = Number(netQuantity) || 0;
    const pct = Number(wastagePercent) || 0;
    const wastageQty = SafeMath.round(qty * (pct / 100), 3);
    const grossQty = SafeMath.round(qty + wastageQty, 3);
    return {
      netQuantity: qty,
      wastagePercent: pct,
      wastageQuantity: wastageQty,
      grossQuantity: grossQty
    };
  }
}
