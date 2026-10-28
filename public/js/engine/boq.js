/**
 * Bill of Quantities (BOQ) & Cost Estimation Engine
 * Separates Physical Quantities from Market Unit Rates
 * Compliant with CPWD / Tamil Nadu PWD Measurement and Tender Formats
 */

import { SafeMath, Validator } from './math.js';

export class BoqEngine {
  /**
   * Calculate BOQ summary and financial grand total
   * @param {Object} params
   * @param {Array<Object>} params.items - List of BOQ line items
   *   [{ id, itemCode, description, quantity, unit, materialRate, labourRate, equipmentRate, notes }]
   * @param {number} [params.contractorProfitPercent=10] - Contractor profit % (standard 10%)
   * @param {number} [params.overheadPercent=5] - Site & office overhead % (standard 5%)
   * @param {number} [params.contingencyPercent=3] - Unforeseen contingencies % (standard 3%)
   * @param {number} [params.gstPercent=18] - GST % on construction contracts (standard 18%)
   */
  static calculate(params) {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new Error('BOQ items must be a non-empty array.');
    }

    const calculatedItems = [];
    let subtotalMaterials = 0;
    let subtotalLabour = 0;
    let subtotalEquipment = 0;
    let directCostSubtotal = 0;

    params.items.forEach((item, idx) => {
      const qCheck = Validator.positiveNumber(`Item ${idx + 1} (${item.description || 'Item'}) Quantity`, item.quantity, true);
      if (!qCheck.valid) throw new Error(qCheck.error);
      const qty = qCheck.value;

      const matRate = Number(item.materialRate) || 0;
      const labRate = Number(item.labourRate) || 0;
      const eqRate = Number(item.equipmentRate) || 0;
      const unitRate = SafeMath.round(matRate + labRate + eqRate, 2);

      const matTotal = SafeMath.round(qty * matRate, 2);
      const labTotal = SafeMath.round(qty * labRate, 2);
      const eqTotal = SafeMath.round(qty * eqRate, 2);
      const itemTotal = SafeMath.round(qty * unitRate, 2);

      subtotalMaterials = SafeMath.round(subtotalMaterials + matTotal, 2);
      subtotalLabour = SafeMath.round(subtotalLabour + labTotal, 2);
      subtotalEquipment = SafeMath.round(subtotalEquipment + eqTotal, 2);
      directCostSubtotal = SafeMath.round(directCostSubtotal + itemTotal, 2);

      calculatedItems.push({
        id: item.id || `BOQ-${idx + 1}`,
        itemCode: item.itemCode || `ITEM-${idx + 1}`,
        description: item.description || 'Civil Work Item',
        quantity: qty,
        unit: item.unit || 'unit',
        materialRate: matRate,
        labourRate: labRate,
        equipmentRate: eqRate,
        unitRate,
        materialTotal: matTotal,
        labourTotal: labTotal,
        equipmentTotal: eqTotal,
        totalAmount: itemTotal,
        rateSource: item.rateSource || 'Market Benchmark',
        rateDate: item.rateDate || new Date().toISOString().split('T')[0],
        notes: item.notes || ''
      });
    });

    // Add Overhead
    const overheadPct = Number(params.overheadPercent) !== undefined ? Number(params.overheadPercent) : 5;
    const overheadAmount = SafeMath.round(directCostSubtotal * (overheadPct / 100), 2);

    // Add Contractor Profit
    const profitPct = Number(params.contractorProfitPercent) !== undefined ? Number(params.contractorProfitPercent) : 10;
    const profitAmount = SafeMath.round((directCostSubtotal + overheadAmount) * (profitPct / 100), 2);

    // Add Contingencies
    const contPct = Number(params.contingencyPercent) !== undefined ? Number(params.contingencyPercent) : 3;
    const contAmount = SafeMath.round(directCostSubtotal * (contPct / 100), 2);

    // Pre-tax Total
    const preTaxTotal = SafeMath.round(directCostSubtotal + overheadAmount + profitAmount + contAmount, 2);

    // GST
    const gstPct = Number(params.gstPercent) !== undefined ? Number(params.gstPercent) : 18;
    const gstAmount = SafeMath.round(preTaxTotal * (gstPct / 100), 2);

    // Grand Total
    const grandTotal = SafeMath.round(preTaxTotal + gstAmount, 2);

    return {
      items: calculatedItems,
      financials: {
        directCostSubtotal,
        directMaterialsTotal: subtotalMaterials,
        directLabourTotal: subtotalLabour,
        directEquipmentTotal: subtotalEquipment,
        overhead: {
          percentage: overheadPct,
          amount: overheadAmount
        },
        contractorProfit: {
          percentage: profitPct,
          amount: profitAmount
        },
        contingency: {
          percentage: contPct,
          amount: contAmount
        },
        preTaxTotal,
        gst: {
          percentage: gstPct,
          amount: gstAmount
        },
        grandTotal,
        formattedDirectCost: SafeMath.formatINR(directCostSubtotal),
        formattedGrandTotal: SafeMath.formatINR(grandTotal)
      },
      audit: {
        totalLineItems: calculatedItems.length,
        calculatedAt: new Date().toISOString()
      },
      disclaimer: 'Quantities are based on deterministic engineering formulas. Market rates reflect specified provenance.'
    };
  }
}
