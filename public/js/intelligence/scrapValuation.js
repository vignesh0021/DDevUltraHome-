/**
 * Scrap Valuation & Settlement Calculator
 * Computes Gross Scrap Value, Physical Deductions, Recovery Factors, and Net Payout
 */

import { SafeMath, Validator } from '../engine/math.js';
import { ScrapRatesEngine } from './scrapRates.js';

export class ScrapValuationEngine {
  /**
   * Calculate Scrap Valuation and Settlement
   * @param {Object} params
   * @param {string} [params.scrapId] - Optional ID from SCRAP_RATE_BENCHMARKS
   * @param {string} [params.materialName='Scrap Metal']
   * @param {number} params.grossWeight - Total weighbridge gross weight
   * @param {number} [params.tareWeight=0] - Vehicle / bin tare weight
   * @param {string} [params.weightUnit='kg'] - 'kg' or 'tonne'
   * @param {number} params.unitRate - Unit price in ₹ per kg (or per tonne)
   * @param {number} [params.moisturePercent=0] - Water/moisture deduction %
   * @param {number} [params.impurityPercent=0] - Dirt, dust, oil, non-metallic deduction %
   * @param {number} [params.insulationDeductionPercent=0] - Wire sheath / insulation deduction %
   * @param {number} [params.flatWeightDeductionKg=0] - Fixed physical deduction in kg
   * @param {number} [params.transportCost=0] - Transport deduction in ₹
   * @param {number} [params.labourHandlingCost=0] - Loading/unloading/cutting deduction in ₹
   * @param {string} [params.dealerName] - Optional dealer quotation source
   */
  static calculate(params) {
    const steps = [];
    const assumptions = [];

    const grossCheck = Validator.positiveNumber('Gross Weight', params.grossWeight);
    if (!grossCheck.valid) throw new Error(grossCheck.error);
    const grossWt = grossCheck.value;

    const tareWt = Number(params.tareWeight) || 0;
    if (tareWt >= grossWt) {
      throw new Error('Tare weight cannot be equal to or greater than gross weight.');
    }

    const unit = (params.weightUnit || 'kg').toLowerCase();
    const rateCheck = Validator.positiveNumber('Unit Rate', params.unitRate);
    if (!rateCheck.valid) throw new Error(rateCheck.error);
    const unitPrice = rateCheck.value;

    // Convert to kg if in tonnes for standard processing
    const isTonne = unit === 'tonne' || unit === 'mt';
    const grossKg = isTonne ? grossWt * 1000 : grossWt;
    const tareKg = isTonne ? tareWt * 1000 : tareWt;
    const netScaleKg = SafeMath.round(grossKg - tareKg, 2);

    steps.push(`Scale Weight: Gross (${grossKg} kg) - Tare (${tareKg} kg) = Net Weighbridge Weight (${netScaleKg} kg)`);

    // Physical Deductions
    const moistPct = Number(params.moisturePercent) || 0;
    const impurPct = Number(params.impurityPercent) || 0;
    const insulPct = Number(params.insulationDeductionPercent) || 0;
    const flatDeductKg = Number(params.flatWeightDeductionKg) || 0;

    const totalPctDeduction = moistPct + impurPct + insulPct;
    if (totalPctDeduction > 95) {
      throw new Error('Combined weight deductions exceed 95% of material.');
    }

    const pctDeductionKg = SafeMath.round(netScaleKg * (totalPctDeduction / 100), 2);
    const totalDeductionWeightKg = SafeMath.round(pctDeductionKg + flatDeductKg, 2);

    if (moistPct > 0) steps.push(`Moisture / Water Deduction: ${moistPct}% = -${SafeMath.round(netScaleKg * (moistPct/100), 2)} kg`);
    if (impurPct > 0) steps.push(`Impurities / Slag / Oil Deduction: ${impurPct}% = -${SafeMath.round(netScaleKg * (impurPct/100), 2)} kg`);
    if (insulPct > 0) steps.push(`Wire Sheath / Insulation Deduction: ${insulPct}% = -${SafeMath.round(netScaleKg * (insulPct/100), 2)} kg`);
    if (flatDeductKg > 0) steps.push(`Flat Scale / Foreign Body Deduction = -${flatDeductKg} kg`);

    const netAcceptedWeightKg = Math.max(0, SafeMath.round(netScaleKg - totalDeductionWeightKg, 2));
    steps.push(`Net Accepted Weight for Settlement = ${netScaleKg} kg - ${totalDeductionWeightKg} kg = ${netAcceptedWeightKg} kg`);

    // Gross Material Value
    // Rate is in ₹/kg (if user passed per tonne, convert rate)
    const effectiveRatePerKg = isTonne ? unitPrice / 1000 : unitPrice;
    const grossValue = SafeMath.round(netAcceptedWeightKg * effectiveRatePerKg, 2);
    steps.push(`Gross Settlement Value = ${netAcceptedWeightKg} kg × ₹${effectiveRatePerKg}/kg = ₹${grossValue.toLocaleString('en-IN')}`);

    // Deduct Handling & Transport expenses
    const transport = Number(params.transportCost) || 0;
    const labour = Number(params.labourHandlingCost) || 0;
    const totalExpenses = SafeMath.round(transport + labour, 2);

    if (transport > 0) steps.push(`Transport & Vehicle Deduction = -₹${transport.toLocaleString('en-IN')}`);
    if (labour > 0) steps.push(`Loading, Unloading & Gas Cutting Deduction = -₹${labour.toLocaleString('en-IN')}`);

    const netPayout = Math.max(0, SafeMath.round(grossValue - totalExpenses, 2));
    steps.push(`Final Net Settlement Payout = ₹${grossValue.toLocaleString('en-IN')} - ₹${totalExpenses.toLocaleString('en-IN')} = ₹${netPayout.toLocaleString('en-IN')}`);

    return {
      materialName: params.materialName || 'Scrap Material',
      weights: {
        grossWeight: grossWt,
        tareWeight: tareWt,
        unit: unit,
        netScaleWeightKg: netScaleKg,
        deductionsKg: {
          moistureKg: SafeMath.round(netScaleKg * (moistPct / 100), 2),
          impuritiesKg: SafeMath.round(netScaleKg * (impurPct / 100), 2),
          insulationKg: SafeMath.round(netScaleKg * (insulPct / 100), 2),
          flatKg: flatDeductKg,
          totalDeductionsKg: totalDeductionWeightKg
        },
        netAcceptedWeightKg,
        netAcceptedWeightTonnes: SafeMath.round(netAcceptedWeightKg / 1000, 3)
      },
      pricing: {
        unitRate: unitPrice,
        rateUnit: isTonne ? '₹ / Tonne' : '₹ / kg',
        effectiveRatePerKg,
        grossValue,
        expenses: {
          transport,
          labourHandling: labour,
          totalExpenses
        },
        netPayout,
        formattedGrossValue: SafeMath.formatINR(grossValue),
        formattedNetPayout: SafeMath.formatINR(netPayout)
      },
      assumptions,
      calculationSteps: steps,
      disclaimer: 'Indicative market valuation. Actual payout requires physical weighing at certified weighbridge and on-site chemical / magnetic spot test verification by buyer.'
    };
  }
}
