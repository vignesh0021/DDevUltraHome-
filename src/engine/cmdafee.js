/**
 * CMDA & Greater Chennai Corporation (GCC) Statutory Approval Fee Estimator
 * In accordance with Tamil Nadu Town & Country Planning Act 1971,
 * TNCDBR 2019, and the Building and Other Construction Workers (BOCW) Act
 */

import { SafeMath, Validator } from './math.js';

export const LOCATION_ZONE_RATES = {
  'GCC_CORE': {
    name: 'Greater Chennai Corporation (GCC Core City - Zones 1 to 15)',
    landDevRatePerM2: 60.0,
    buildingDevRatePerM2: 75.0,
    iaChargesPerM2: 450.0,
    licenseFeePerM2: 25.0
  },
  'CMA_MUNICIPALITY': {
    name: 'Chennai Metropolitan Area Municipalities (Tambaram / Avadi / Poonamallee)',
    landDevRatePerM2: 40.0,
    buildingDevRatePerM2: 50.0,
    iaChargesPerM2: 375.0,
    licenseFeePerM2: 20.0
  },
  'CMA_PANCHAYAT': {
    name: 'CMA Town / Village Panchayats (Kovur, Guduvanchery, Thiruporur, Kelambakkam)',
    landDevRatePerM2: 25.0,
    buildingDevRatePerM2: 35.0,
    iaChargesPerM2: 300.0,
    licenseFeePerM2: 15.0
  }
};

export class CmdaFeeEngine {
  /**
   * Estimate Government Statutory Sanction Fees for Planning Permission & Building Permit
   * @param {Object} params
   * @param {number} params.plotAreaSqft - Total plot area in sq.ft
   * @param {number} params.totalBuiltupSqft - Total proposed built-up area across all floors
   * @param {string} [params.locationZone='GCC_CORE'] - Key from LOCATION_ZONE_RATES
   * @param {number} [params.estimatedCostPerSqft=2400] - Estimated civil construction cost / sq.ft for Labour Cess
   */
  static estimateFees(params) {
    const steps = [];

    const plotCheck = Validator.positiveNumber('Plot Area', params.plotAreaSqft);
    const builtCheck = Validator.positiveNumber('Built-up Area', params.totalBuiltupSqft);

    if (!plotCheck.valid) throw new Error(plotCheck.error);
    if (!builtCheck.valid) throw new Error(builtCheck.error);

    const plotSqft = plotCheck.value;
    const builtSqft = builtCheck.value;
    const plotM2 = SafeMath.round(plotSqft / 10.7639, 2);
    const builtM2 = SafeMath.round(builtSqft / 10.7639, 2);

    const zoneKey = params.locationZone || 'GCC_CORE';
    const zone = LOCATION_ZONE_RATES[zoneKey] || LOCATION_ZONE_RATES['GCC_CORE'];
    const constrRateSqft = Number(params.estimatedCostPerSqft) || 2400;

    steps.push(`Project Scale: Plot = ${plotSqft} sq.ft (${plotM2} m²), Total Built-up = ${builtSqft} sq.ft (${builtM2} m²)`);
    steps.push(`Local Authority Jurisdiction: ${zone.name}`);

    // 1. Scrutiny Fee (Minimum ₹1,500 or ₹4.00 per m²)
    const scrutinyRatePerM2 = 4.0;
    const scrutinyFee = Math.max(1500, SafeMath.round(builtM2 * scrutinyRatePerM2, 0));
    steps.push(`1. CMDA / GCC Scrutiny Fee: ${builtM2} m² × ₹${scrutinyRatePerM2}/m² = ₹${scrutinyFee.toLocaleString('en-IN')}`);

    // 2. Development Charges (Section 59 of TCP Act 1971)
    // Land Dev Charge + Building Dev Charge
    const landDevFee = SafeMath.round(plotM2 * zone.landDevRatePerM2, 0);
    const buildingDevFee = SafeMath.round(builtM2 * zone.buildingDevRatePerM2, 0);
    const totalDevCharges = SafeMath.round(landDevFee + buildingDevFee, 0);
    steps.push(`2. Development Charges: Land (${plotM2} m² × ₹${zone.landDevRatePerM2}) + Building (${builtM2} m² × ₹${zone.buildingDevRatePerM2}) = ₹${totalDevCharges.toLocaleString('en-IN')}`);

    // 3. Infrastructure & Amenities (I&A) Charges (Section 63-B of TCP Act)
    const iaCharges = SafeMath.round(builtM2 * zone.iaChargesPerM2, 0);
    steps.push(`3. Infrastructure & Amenities (I&A) Charges: ${builtM2} m² × ₹${zone.iaChargesPerM2}/m² = ₹${iaCharges.toLocaleString('en-IN')}`);

    // 4. Tamil Nadu Construction Workers Welfare Fund (1% Labour Cess)
    // Mandatory 1% of total estimated building construction cost
    const totalConstructionCost = SafeMath.round(builtSqft * constrRateSqft, 0);
    const labourCess = SafeMath.round(totalConstructionCost * 0.01, 0);
    steps.push(`4. 1% BOCW Labour Welfare Cess: 1% of Estimated Cost (₹${totalConstructionCost.toLocaleString('en-IN')} @ ₹${constrRateSqft}/sq.ft) = ₹${labourCess.toLocaleString('en-IN')}`);

    // 5. GCC Building License & Debris Charges
    const licenseFee = SafeMath.round(builtM2 * zone.licenseFeePerM2, 0);
    const debrisCharges = Math.min(10000, Math.max(3000, Math.round(builtM2 * 8 / 500) * 500));
    const rwhSecurityDeposit = 5000; // Standard refundable deposit
    const gccFees = SafeMath.round(licenseFee + debrisCharges + rwhSecurityDeposit, 0);
    steps.push(`5. Local Body License, Debris & RWH Deposit: License (₹${licenseFee}) + Debris (₹${debrisCharges}) + Refundable RWH Deposit (₹${rwhSecurityDeposit}) = ₹${gccFees.toLocaleString('en-IN')}`);

    // Total Government Sanction Cost
    const totalStatutoryFees = SafeMath.round(scrutinyFee + totalDevCharges + iaCharges + labourCess + gccFees, 0);
    steps.push(`Total Statutory Approval Outlay = ₹${totalStatutoryFees.toLocaleString('en-IN')}`);

    return {
      jurisdiction: zone.name,
      areas: { plotAreaSqft: plotSqft, plotAreaM2: plotM2, builtupSqft: builtSqft, builtupM2: builtM2 },
      feeBreakdown: {
        scrutinyFee: { amount: scrutinyFee, formatted: SafeMath.formatINR(scrutinyFee) },
        developmentCharges: {
          landComponent: landDevFee,
          buildingComponent: buildingDevFee,
          total: totalDevCharges,
          formatted: SafeMath.formatINR(totalDevCharges)
        },
        iaCharges: { amount: iaCharges, formatted: SafeMath.formatINR(iaCharges) },
        labourWelfareCess1Pct: {
          estimatedBuildingCost: totalConstructionCost,
          amount: labourCess,
          formatted: SafeMath.formatINR(labourCess)
        },
        localBodyLicenseAndDebris: {
          licenseFee,
          debrisRemoval: debrisCharges,
          rwhRefundableDeposit: rwhSecurityDeposit,
          total: gccFees,
          formatted: SafeMath.formatINR(gccFees)
        }
      },
      totalStatutoryAmount: totalStatutoryFees,
      formattedTotalStatutoryAmount: SafeMath.formatINR(totalStatutoryFees),
      calculationSteps: steps,
      disclaimer: 'Statutory fees are estimates based on standard CMDA / GCC government orders and TCP Act schedules. Final demand notice issued via TNSWS single window portal will govern.'
    };
  }
}
