/**
 * Measurement Book (M-Book) & Running Account (RA) Billing Engine
 * Standard Public Works / Private Contracting Measurement & Progress Billing
 */

import { SafeMath } from './math.js';

export class MBookEngine {
  /**
   * Calculate exact measured quantity from M-Book dimension entries
   * Formula: Quantity = Nos * Length * Breadth * Depth
   * @param {Array<Object>} entries
   * [{ description: 'Grid A-B Outer Wall', nos: 2, lengthM: 6.0, breadthM: 0.23, depthM: 3.0 }]
   */
  static calculateItemQuantity(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return { entries: [], totalQuantity: 0, totalAmount: 0 };

    let total = 0;
    let unitRate = 0;
    const computedEntries = entries.map((e, idx) => {
      const nos = Number(e.nos !== undefined ? e.nos : (e.count !== undefined ? e.count : 1)) || 1;
      const l = Number(e.lengthM !== undefined ? e.lengthM : (e.length !== undefined ? e.length : 0)) || 0;
      const b = Number(e.breadthM !== undefined ? e.breadthM : (e.breadth !== undefined ? e.breadth : 0)) || 0;
      const d = Number(e.depthM !== undefined ? e.depthM : (e.depth !== undefined ? e.depth : 1));
      const rate = Number(e.unitRate !== undefined ? e.unitRate : (e.rate !== undefined ? e.rate : 0));
      if (rate > 0) unitRate = rate;

      const qty = SafeMath.round(nos * l * b * d, 3);
      total = SafeMath.round(total + qty, 3);

      return {
        index: idx + 1,
        location: e.location || e.description || `Location ${idx + 1}`,
        nos,
        lengthM: l,
        breadthM: b,
        depthM: d,
        unitRate: rate,
        quantity: qty
      };
    });

    const totalAmount = unitRate > 0 ? SafeMath.round(total * unitRate, 2) : 0;

    return {
      entries: computedEntries,
      totalQuantity: total,
      unitRate,
      totalAmount
    };
  }

  /**
   * Generate Running Account (RA) Bill with Retention & Statutory Deductions
   * @param {Object} params
   * @param {string} [params.billNumber='RA Bill No. 1'] - Bill designation
   * @param {number} [params.previousGrossCertified=0] - Cumulative value certified in previous bills
   * @param {Array<Object>} params.billItems - Items completed in this period:
   *   [{ itemCode, description, unit, quantitySinceLastBill, rate }]
   * @param {number} [params.retentionPercent=5.0] - Retention security deposit % (standard 5%)
   * @param {number} [params.advanceRecoveryPercent=0] - Mobilization advance deduction %
   * @param {number} [params.tdsPercent=1.0] - Income Tax TDS % (Sec 194C)
   * @param {number} [params.labourCessPercent=1.0] - BOCW Labour Welfare Cess % (1% standard)
   */
  static generateRaBill(params) {
    const items = Array.isArray(params.billItems) ? params.billItems : [];
    let currentBillDirectAmount = 0;

    const evaluatedItems = items.map((it, idx) => {
      const qty = Number(it.quantitySinceLastBill) || 0;
      const rate = Number(it.rate) || 0;
      const amount = SafeMath.round(qty * rate, 2);
      currentBillDirectAmount = SafeMath.round(currentBillDirectAmount + amount, 2);

      return {
        itemNo: idx + 1,
        itemCode: it.itemCode || `ITEM-${idx + 1}`,
        description: it.description || 'Civil Work Item',
        unit: it.unit || 'unit',
        quantity: qty,
        rate,
        amount,
        formattedAmount: SafeMath.formatINR(amount)
      };
    });

    const previousGross = Number(params.previousGrossCertified) || 0;
    const cumulativeGross = SafeMath.round(previousGross + currentBillDirectAmount, 2);

    // Contractual & Statutory Deductions
    const retentionPct = Number(params.retentionPercent) !== undefined ? Number(params.retentionPercent) : 5.0;
    const retentionDeduction = SafeMath.round(currentBillDirectAmount * (retentionPct / 100), 2);

    const advRecovPct = Number(params.advanceRecoveryPercent) || 0;
    const advanceDeduction = SafeMath.round(currentBillDirectAmount * (advRecovPct / 100), 2);

    const tdsPct = Number(params.tdsPercent) !== undefined ? Number(params.tdsPercent) : 1.0;
    const tdsDeduction = SafeMath.round(currentBillDirectAmount * (tdsPct / 100), 2);

    const cessPct = Number(params.labourCessPercent) !== undefined ? Number(params.labourCessPercent) : 1.0;
    const cessDeduction = SafeMath.round(currentBillDirectAmount * (cessPct / 100), 2);

    const totalDeductions = SafeMath.round(retentionDeduction + advanceDeduction + tdsDeduction + cessDeduction, 2);
    const netPayable = Math.max(0, SafeMath.round(currentBillDirectAmount - totalDeductions, 2));

    return {
      billNumber: params.billNumber || 'RA Bill No. 1',
      date: new Date().toISOString().split('T')[0],
      items: evaluatedItems,
      financials: {
        currentBillGrossValue: currentBillDirectAmount,
        previousGrossValueCertified: previousGross,
        cumulativeGrossValueToDate: cumulativeGross,
        deductions: {
          retentionMoney: { percentage: retentionPct, amount: retentionDeduction },
          advanceRecovery: { percentage: advRecovPct, amount: advanceDeduction },
          tdsSec194C: { percentage: tdsPct, amount: tdsDeduction },
          labourWelfareCess: { percentage: cessPct, amount: cessDeduction },
          totalDeductions
        },
        netPayableToContractor: netPayable,
        formattedCurrentGross: SafeMath.formatINR(currentBillDirectAmount),
        formattedTotalDeductions: SafeMath.formatINR(totalDeductions),
        formattedNetPayable: SafeMath.formatINR(netPayable)
      },
      audit: {
        preparedBy: 'Site Engineer / Quantity Surveyor',
        status: 'CERTIFIED_FOR_PAYMENT'
      }
    };
  }
}
