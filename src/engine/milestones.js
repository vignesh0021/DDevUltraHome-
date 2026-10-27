/**
 * Contractor Payment Milestones & Schedule Engine
 * Tamil Nadu Standard Residential Civil Engineering Practice
 */

import { SafeMath } from './math.js';

export const STANDARD_CONTRACT_MILESTONES = [
  {
    stage: 1,
    name: 'Booking, Architectural Plan & Bhoomi Pooja Advance',
    nameTa: 'முன்பணம் மற்றும் பூமி பூஜை தொடக்கம்',
    percentage: 10,
    deliverables: 'Soil investigation, structural drawings approval, site clearing, Bhoomi Pooja'
  },
  {
    stage: 2,
    name: 'Foundation & Basement Plinth Beam Completion',
    nameTa: 'அஸ்திவாரம் மற்றும் பிளின்த் பீம் நிறைவு',
    percentage: 20,
    deliverables: 'Earthwork excavation, PCC bed, isolated footings, column neck stubs, plinth beam RCC casting & gravel backfilling'
  },
  {
    stage: 3,
    name: 'Ground Floor Columns & Roof Lintel Level',
    nameTa: 'தூண்கள் மற்றும் லிண்டல் மட்டம் நிறைவு',
    percentage: 15,
    deliverables: 'RCC columns casting up to ceiling height, lintel beams, chajja sunshades'
  },
  {
    stage: 4,
    name: 'Roof Slab RCC Casting Completion',
    nameTa: 'தளம் கான்கிரீட் போடுதல் நிறைவு',
    percentage: 20,
    deliverables: 'Slab shuttering, BBS rebar tying, electrical conduit laying, M20/M25 concrete pouring and curing'
  },
  {
    stage: 5,
    name: 'Brick Masonry & Electrical/Plumbing Rough-in',
    nameTa: 'செங்கல் சுவர் மற்றும் பைப்லைன் வேலைகள்',
    percentage: 15,
    deliverables: 'Outer 9" and inner 4.5" brickwork, door frames fixing, concealed electrical boxes and plumbing lines'
  },
  {
    stage: 6,
    name: 'Internal & External Plastering, Flooring & Tiling',
    nameTa: 'பூச்சு வேலை மற்றும் தரை டைல்ஸ் அமைத்தல்',
    percentage: 12,
    deliverables: 'Ceiling and wall 12mm/15mm plastering, waterproofing, vitrified tiles laying with 4" skirting'
  },
  {
    stage: 7,
    name: 'Painting, Fixtures Handover & Final Key Handover',
    nameTa: 'வண்ணம் பூசுதல் மற்றும் சாவி ஒப்படைப்பு',
    percentage: 8,
    deliverables: 'Putty + 2 coats emulsion painting, sanitaryware & CP fittings, main door polishing, electrical switches, final site cleanup and key handover'
  }
];

export class MilestonesEngine {
  /**
   * Calculate milestone amounts and payment schedule from total contract value
   * @param {number} totalContractAmount
   * @param {Array<Object>} [customStages]
   */
  static calculateSchedule(totalContractAmount, customStages = null) {
    const total = Number(totalContractAmount) || 0;
    const stages = customStages || STANDARD_CONTRACT_MILESTONES;

    let cumulativePct = 0;
    let cumulativeAmount = 0;

    const schedule = stages.map(st => {
      const pct = Number(st.percentage) || 0;
      const amount = SafeMath.round(total * (pct / 100), 2);
      cumulativePct = SafeMath.round(cumulativePct + pct, 1);
      cumulativeAmount = SafeMath.round(cumulativeAmount + amount, 2);

      return {
        stage: st.stage,
        name: st.name,
        nameTa: st.nameTa,
        percentage: pct,
        amount,
        formattedAmount: SafeMath.formatINR(amount),
        cumulativePercentage: cumulativePct,
        cumulativeAmount,
        formattedCumulativeAmount: SafeMath.formatINR(cumulativeAmount),
        deliverables: st.deliverables
      };
    });

    return {
      totalContractAmount: total,
      formattedTotalContractAmount: SafeMath.formatINR(total),
      stagesCount: schedule.length,
      schedule
    };
  }
}
