/**
 * DDevUltraHome — Quick Financial Calculator Component
 * 
 * Lightweight calculator for Income, Expense, Wages, and Quotation forms.
 * Rules:
 * - Basic arithmetic (+, -, *, /) with division-by-zero protection.
 * - Quantity × Rate instant calculation.
 * - Multiple line-item total builder.
 * - Discount (% or ₹) and Tax (% or ₹) computation.
 * - Round-off support.
 * - Safe insertion: Never silently overwrite an existing non-zero value.
 * - Form data in parent screen is preserved completely.
 */

import { SafeMath } from '../engine/math.js';
import { AppDialog } from './appDialog.js';

/**
 * Pure calculation logic (testable in Node and Browser)
 */
export const QuickCalcEngine = {
  /**
   * Qty x Rate
   */
  calculateQtyRate(qty, rate) {
    const q = parseFloat(qty);
    const r = parseFloat(rate);
    if (isNaN(q) || isNaN(r) || q <= 0 || r <= 0) return 0;
    return SafeMath.round(q * r, 2);
  },

  /**
   * Calculate multiple line items
   * items: [{ qty, rate, amount }]
   */
  calculateLineItems(items = []) {
    if (!Array.isArray(items)) return 0;
    const sum = items.reduce((acc, it) => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.rate) || 0;
      const rowTotal = it.amount !== undefined && !isNaN(parseFloat(it.amount))
        ? parseFloat(it.amount)
        : q * r;
      return acc + rowTotal;
    }, 0);
    return SafeMath.round(sum, 2);
  },

  /**
   * Calculate discount amount
   */
  calculateDiscount(subtotal, type, value) {
    const sub = Math.max(0, parseFloat(subtotal) || 0);
    const val = Math.max(0, parseFloat(value) || 0);
    if (val === 0) return 0;

    if (type === 'PERCENT') {
      const clampedPct = Math.min(100, val);
      return SafeMath.round(sub * (clampedPct / 100), 2);
    }
    // Flat ₹
    return SafeMath.round(Math.min(sub, val), 2);
  },

  /**
   * Calculate tax amount
   */
  calculateTax(taxableAmount, taxPercent) {
    const base = Math.max(0, parseFloat(taxableAmount) || 0);
    const pct = Math.max(0, parseFloat(taxPercent) || 0);
    return SafeMath.round(base * (pct / 100), 2);
  },

  /**
   * Evaluate arithmetic expression string (+, -, *, /) safely
   */
  evaluateExpression(expr) {
    if (!expr || typeof expr !== 'string') {
      throw new Error('Invalid expression');
    }
    const sanitized = expr.replace(/\s+/g, '');
    if (!/^[0-9+\-*/.()]+$/.test(sanitized)) {
      throw new Error('Invalid characters in calculation expression');
    }

    // Check for division by zero: /0 or /0.0
    if (/\/(0+(\.0*)?)(?![0-9])/.test(sanitized)) {
      throw new Error('Division by zero is not permitted');
    }

    try {
      // Use Function constructor with strict sanitization
      const result = new Function(`return (${sanitized});`)();
      if (!isFinite(result) || isNaN(result)) {
        throw new Error('Calculation result is invalid');
      }
      return SafeMath.round(result, 2);
    } catch (err) {
      if (err.message.includes('Division by zero')) throw err;
      throw new Error('Syntax error in arithmetic expression');
    }
  },

  /**
   * Compute complete order/bill financial breakdown
   */
  computeBreakdown({ subtotal, items = [], discountType = 'PERCENT', discountValue = 0, taxPercent = 0, shouldRoundOff = false }) {
    let sub = Math.max(0, parseFloat(subtotal) || 0);
    if ((!sub || sub === 0) && Array.isArray(items) && items.length > 0) {
      sub = this.calculateLineItems(items);
    }
    const discAmt = this.calculateDiscount(sub, discountType, discountValue);
    const afterDiscount = SafeMath.round(Math.max(0, sub - discAmt), 2);
    const taxAmt = this.calculateTax(afterDiscount, taxPercent);
    const preRound = SafeMath.round(afterDiscount + taxAmt, 2);

    let finalTotal = preRound;
    let roundOffDiff = 0;
    if (shouldRoundOff) {
      finalTotal = Math.round(preRound);
      roundOffDiff = SafeMath.round(finalTotal - preRound, 2);
    }

    return {
      subtotal: sub,
      discountAmount: discAmt,
      taxableAmount: afterDiscount,
      taxAmount: taxAmt,
      roundOffDifference: roundOffDiff,
      finalTotal: SafeMath.round(finalTotal, 2)
    };
  }
};

/**
 * UI Launcher for Quick Calculator
 * @param {Object} options
 * @param {HTMLInputElement|string} options.targetInput - input element or ID
 * @param {number} [options.initialValue=0] - starting value
 * @param {string} [options.title='Financial Calculator']
 * @param {Function} [options.onApply] - callback (amount) => void
 */
export function openQuickCalculator({
  targetInput = null,
  initialValue = 0,
  title = 'Quick Financial Calculator',
  onApply = null
} = {}) {
  const existing = document.getElementById('ddev-quick-calc-modal');
  if (existing) existing.remove();

  let targetEl = null;
  if (typeof targetInput === 'string') {
    targetEl = document.getElementById(targetInput);
  } else if (targetInput instanceof HTMLElement) {
    targetEl = targetInput;
  }

  let activeTab = 'QTY_RATE'; // 'QTY_RATE' | 'LINE_ITEMS' | 'EXPRESSION'
  let lineItems = [
    { desc: 'Item 1', qty: 1, rate: 0, amount: 0 }
  ];
  let discountType = 'PERCENT';
  let discountVal = 0;
  let taxPercent = 0;
  let roundOff = false;
  let expressionText = '';

  const overlay = document.createElement('div');
  overlay.id = 'ddev-quick-calc-modal';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center; padding: 12px;
    backdrop-filter: blur(3px); animation: fadeIn 0.15s ease-out;
  `;

  function render() {
    overlay.innerHTML = `
      <div class="modal-animated" style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-light, #CBD5E1); border-radius: 16px; width: 100%; max-width: 440px; max-height: 85dvh; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 30px -5px rgba(0,0,0,0.4); animation: modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-light, #E2E8F0); background: var(--bg-surface, #F8FAFC);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🧮</span>
            <span style="font-weight: 800; font-size: 15px; color: var(--brand-navy-900, #0B192C);">${title}</span>
          </div>
          <button id="qcalc-btn-close" style="background: transparent; border: none; font-size: 18px; font-weight: 700; color: #64748B; cursor: pointer; padding: 4px 8px; touch-action: manipulation;">✕</button>
        </div>

        <!-- Mode Segmented Tabs -->
        <div style="display: flex; background: var(--bg-body, #F1F5F9); padding: 4px; border-bottom: 1px solid var(--border-light, #E2E8F0); gap: 4px;">
          <button id="tab-qty-rate" class="tab-btn" style="flex: 1; padding: 8px 4px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; ${activeTab === 'QTY_RATE' ? 'background: #2563EB; color: #FFF;' : 'background: transparent; color: #475569;'}">
            Qty × Rate
          </button>
          <button id="tab-lines" class="tab-btn" style="flex: 1; padding: 8px 4px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; ${activeTab === 'LINE_ITEMS' ? 'background: #2563EB; color: #FFF;' : 'background: transparent; color: #475569;'}">
            Line Items
          </button>
          <button id="tab-expr" class="tab-btn" style="flex: 1; padding: 8px 4px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; ${activeTab === 'EXPRESSION' ? 'background: #2563EB; color: #FFF;' : 'background: transparent; color: #475569;'}">
            Arithmetic (+ - × ÷)
          </button>
        </div>

        <!-- Tab Body -->
        <div id="qcalc-content" style="flex: 1; overflow-y: auto; padding: 16px;">
          ${renderTabContent()}
        </div>

        <!-- Grand Total Bar & Actions -->
        <div style="padding: 12px 16px; border-top: 1px solid var(--border-light, #E2E8F0); background: var(--bg-surface, #F8FAFC);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary, #64748B);">Computed Amount:</span>
            <span id="qcalc-result-badge" style="font-size: 18px; font-weight: 900; color: #16A34A; font-family: monospace; font-variant-numeric: tabular-nums;">
              ₹${getComputedTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="qcalc-btn-cancel" class="btn-outline" style="flex: 1; min-height: 42px; font-size: 13px; font-weight: 600; touch-action: manipulation;">
              Cancel
            </button>
            <button id="qcalc-btn-apply" class="btn-primary" style="flex: 2; min-height: 42px; font-size: 13px; font-weight: 800; background: #2563EB; color: white; display: flex; align-items: center; justify-content: center; gap: 6px; touch-action: manipulation;">
              <span>✓ Insert Amount</span>
            </button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderTabContent() {
    if (activeTab === 'QTY_RATE') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 4px;">Quantity</label>
            <input type="number" id="inp-qr-qty" class="form-control" style="width: 100%; font-size: 16px; font-weight: 600;" placeholder="e.g. 12" value="1" step="any" min="0">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 4px;">Rate per Unit (₹)</label>
            <input type="number" id="inp-qr-rate" class="form-control" style="width: 100%; font-size: 16px; font-weight: 600;" placeholder="e.g. 450" value="${initialValue || ''}" step="any" min="0">
          </div>

          <!-- Modifiers (Discount, Tax, Round-off) -->
          ${renderModifiersSection()}
        </div>
      `;
    }

    if (activeTab === 'LINE_ITEMS') {
      return `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary, #475569);">Items List</span>
            <button id="btn-add-line" style="background: #EEF2FF; color: #4F46E5; border: 1px dashed #6366F1; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
              + Add Item
            </button>
          </div>

          <div id="line-items-container" style="display: flex; flex-direction: column; gap: 8px;">
            ${lineItems.map((item, idx) => `
              <div style="display: flex; gap: 6px; align-items: center; background: var(--bg-surface, #F8FAFC); padding: 8px; border-radius: 8px; border: 1px solid var(--border-light, #E2E8F0);">
                <input type="text" class="line-desc form-control" data-idx="${idx}" placeholder="Desc" value="${item.desc}" style="flex: 2; font-size: 16px;">
                <input type="number" class="line-qty form-control" data-idx="${idx}" placeholder="Qty" value="${item.qty}" style="flex: 1; font-size: 16px; width: 60px;" step="any" min="0">
                <input type="number" class="line-rate form-control" data-idx="${idx}" placeholder="Rate" value="${item.rate}" style="flex: 1.2; font-size: 16px; width: 70px;" step="any" min="0">
                <button class="btn-del-line" data-idx="${idx}" style="background: transparent; border: none; color: #EF4444; font-weight: bold; cursor: pointer; padding: 4px; touch-action: manipulation;">✕</button>
              </div>
            `).join('')}
          </div>

          <!-- Modifiers -->
          ${renderModifiersSection()}
        </div>
      `;
    }

    // EXPRESSION TAB
    return `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 4px;">Arithmetic Expression</label>
          <input type="text" id="inp-expr-display" class="form-control" style="width: 100%; font-size: 16px; font-weight: 700; text-align: right; font-family: monospace;" placeholder="0" value="${expressionText}" readonly>
        </div>
        <div id="expr-error" style="color: #DC2626; font-size: 11px; font-weight: 600; min-height: 16px;"></div>

        <!-- Keypad Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
          <button class="btn-calc-key" data-val="C" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FEE2E2; color: #DC2626; font-weight: 800; font-size: 14px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">C</button>
          <button class="btn-calc-key" data-val="(" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #F1F5F9; font-weight: 700; font-size: 14px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">(</button>
          <button class="btn-calc-key" data-val=")" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #F1F5F9; font-weight: 700; font-size: 14px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">)</button>
          <button class="btn-calc-key" data-val="/" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #DBEAFE; color: #1D4ED8; font-weight: 800; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">÷</button>

          <button class="btn-calc-key" data-val="7" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">7</button>
          <button class="btn-calc-key" data-val="8" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">8</button>
          <button class="btn-calc-key" data-val="9" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">9</button>
          <button class="btn-calc-key" data-val="*" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #DBEAFE; color: #1D4ED8; font-weight: 800; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">×</button>

          <button class="btn-calc-key" data-val="4" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">4</button>
          <button class="btn-calc-key" data-val="5" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">5</button>
          <button class="btn-calc-key" data-val="6" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">6</button>
          <button class="btn-calc-key" data-val="-" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #DBEAFE; color: #1D4ED8; font-weight: 800; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">−</button>

          <button class="btn-calc-key" data-val="1" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">1</button>
          <button class="btn-calc-key" data-val="2" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">2</button>
          <button class="btn-calc-key" data-val="3" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">3</button>
          <button class="btn-calc-key" data-val="+" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #DBEAFE; color: #1D4ED8; font-weight: 800; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">+</button>

          <button class="btn-calc-key" data-val="0" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">0</button>
          <button class="btn-calc-key" data-val="." style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: var(--bg-card, #FFF); font-weight: 700; font-size: 15px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">.</button>
          <button class="btn-calc-key" data-val="DEL" style="padding: 12px; border-radius: 8px; border: 1px solid #CBD5E1; background: #F1F5F9; font-weight: 700; font-size: 13px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">⌫</button>
          <button class="btn-calc-key" data-val="=" style="padding: 12px; border-radius: 8px; border: 1px solid #16A34A; background: #16A34A; color: white; font-weight: 800; font-size: 16px; touch-action: manipulation; user-select: none; -webkit-user-select: none;">=</button>
        </div>
      </div>
    `;
  }

  function renderModifiersSection() {
    return `
      <div style="background: var(--bg-surface, #F8FAFC); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 11px; font-weight: 800; color: var(--text-secondary, #64748B); text-transform: uppercase;">
          Modifiers (Discount & Tax)
        </div>
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748B; margin-bottom: 2px;">Discount</label>
            <div style="display: flex; gap: 4px;">
              <input type="number" id="inp-discount-val" class="form-control" style="flex: 1; font-size: 16px;" placeholder="0" value="${discountVal || ''}" min="0">
              <select id="sel-discount-type" class="form-control" style="width: 58px; font-size: 16px; padding: 0 4px;">
                <option value="PERCENT" ${discountType === 'PERCENT' ? 'selected' : ''}>%</option>
                <option value="FLAT" ${discountType === 'FLAT' ? 'selected' : ''}>₹</option>
              </select>
            </div>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748B; margin-bottom: 2px;">Tax / GST (%)</label>
            <select id="sel-tax-pct" class="form-control" style="width: 100%; font-size: 16px;">
              <option value="0" ${taxPercent === 0 ? 'selected' : ''}>None (0%)</option>
              <option value="5" ${taxPercent === 5 ? 'selected' : ''}>5%</option>
              <option value="12" ${taxPercent === 12 ? 'selected' : ''}>12%</option>
              <option value="18" ${taxPercent === 18 ? 'selected' : ''}>18% (GST)</option>
              <option value="28" ${taxPercent === 28 ? 'selected' : ''}>28%</option>
            </select>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
          <label style="font-size: 12px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="chk-roundoff" ${roundOff ? 'checked' : ''} style="width: 16px; height: 16px;">
            Round-off Total (₹)
          </label>
        </div>
      </div>
    `;
  }

  function getRawSubtotal() {
    if (activeTab === 'QTY_RATE') {
      const q = parseFloat(overlay.querySelector('#inp-qr-qty')?.value) || 0;
      const r = parseFloat(overlay.querySelector('#inp-qr-rate')?.value) || 0;
      return QuickCalcEngine.calculateQtyRate(q, r);
    }
    if (activeTab === 'LINE_ITEMS') {
      return QuickCalcEngine.calculateLineItems(lineItems);
    }
    if (activeTab === 'EXPRESSION') {
      if (!expressionText) return 0;
      try {
        return QuickCalcEngine.evaluateExpression(expressionText);
      } catch {
        return 0;
      }
    }
    return 0;
  }

  function getComputedTotal() {
    if (activeTab === 'EXPRESSION') {
      return getRawSubtotal();
    }
    const subtotal = getRawSubtotal();
    const bd = QuickCalcEngine.computeBreakdown({
      subtotal,
      discountType,
      discountValue: discountVal,
      taxPercent,
      shouldRoundOff: roundOff
    });
    return bd.finalTotal;
  }

  function updateBadge() {
    const badge = overlay.querySelector('#qcalc-result-badge');
    if (badge) {
      badge.textContent = `₹${getComputedTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  function bindEvents() {
    // Close button
    overlay.querySelector('#qcalc-btn-close').onclick = () => overlay.remove();
    overlay.querySelector('#qcalc-btn-cancel').onclick = () => overlay.remove();

    // Tab buttons
    overlay.querySelector('#tab-qty-rate').onclick = () => {
      activeTab = 'QTY_RATE';
      render();
    };
    overlay.querySelector('#tab-lines').onclick = () => {
      activeTab = 'LINE_ITEMS';
      render();
    };
    overlay.querySelector('#tab-expr').onclick = () => {
      activeTab = 'EXPRESSION';
      render();
    };

    // Modifiers bindings
    const discInp = overlay.querySelector('#inp-discount-val');
    if (discInp) {
      discInp.oninput = (e) => {
        discountVal = parseFloat(e.target.value) || 0;
        updateBadge();
      };
    }
    const discTypeSel = overlay.querySelector('#sel-discount-type');
    if (discTypeSel) {
      discTypeSel.onchange = (e) => {
        discountType = e.target.value;
        updateBadge();
      };
    }
    const taxSel = overlay.querySelector('#sel-tax-pct');
    if (taxSel) {
      taxSel.onchange = (e) => {
        taxPercent = parseFloat(e.target.value) || 0;
        updateBadge();
      };
    }
    const roundChk = overlay.querySelector('#chk-roundoff');
    if (roundChk) {
      roundChk.onchange = (e) => {
        roundOff = e.target.checked;
        updateBadge();
      };
    }

    // Qty x Rate inputs
    if (activeTab === 'QTY_RATE') {
      const qInp = overlay.querySelector('#inp-qr-qty');
      const rInp = overlay.querySelector('#inp-qr-rate');
      if (qInp) qInp.oninput = () => updateBadge();
      if (rInp) rInp.oninput = () => updateBadge();
    }

    // Line items bindings
    if (activeTab === 'LINE_ITEMS') {
      const addBtn = overlay.querySelector('#btn-add-line');
      if (addBtn) {
        addBtn.onclick = () => {
          lineItems.push({ desc: `Item ${lineItems.length + 1}`, qty: 1, rate: 0, amount: 0 });
          render();
        };
      }
      overlay.querySelectorAll('.line-desc').forEach(el => {
        el.oninput = (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          lineItems[idx].desc = e.target.value;
        };
      });
      overlay.querySelectorAll('.line-qty').forEach(el => {
        el.oninput = (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          lineItems[idx].qty = parseFloat(e.target.value) || 0;
          updateBadge();
        };
      });
      overlay.querySelectorAll('.line-rate').forEach(el => {
        el.oninput = (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          lineItems[idx].rate = parseFloat(e.target.value) || 0;
          updateBadge();
        };
      });
      overlay.querySelectorAll('.btn-del-line').forEach(el => {
        el.onclick = (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          if (lineItems.length > 1) {
            lineItems.splice(idx, 1);
            render();
          }
        };
      });
    }

    // Expression Keypad bindings
    if (activeTab === 'EXPRESSION') {
      const display = overlay.querySelector('#inp-expr-display');
      const errBox = overlay.querySelector('#expr-error');

      overlay.querySelectorAll('.btn-calc-key').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.val;
          errBox.textContent = '';

          if (val === 'C') {
            expressionText = '';
          } else if (val === 'DEL') {
            expressionText = expressionText.slice(0, -1);
          } else if (val === '=') {
            try {
              const res = QuickCalcEngine.evaluateExpression(expressionText);
              expressionText = res.toString();
            } catch (err) {
              errBox.textContent = err.message;
            }
          } else {
            // Append token
            expressionText += val;
          }

          if (display) display.value = expressionText;
          updateBadge();
        };
      });
    }

    // Apply button with Non-Destructive Overwrite Guard
    const applyBtn = overlay.querySelector('#qcalc-btn-apply');
    if (applyBtn) {
      applyBtn.onclick = async () => {
        const calculatedAmount = getComputedTotal();
        if (calculatedAmount <= 0) {
          const proceed = await AppDialog.confirm({
            title: 'Zero Amount',
            message: 'Calculated amount is ₹0.00. Insert ₹0 into field?'
          });
          if (!proceed) return;
        }

        // Check if target input already has a non-zero value
        if (targetEl && targetEl.value) {
          const currentVal = parseFloat(targetEl.value);
          if (!isNaN(currentVal) && currentVal > 0 && currentVal !== calculatedAmount) {
            const confirmed = await AppDialog.confirm({
              title: 'Overwrite Existing Value?',
              message: `The field currently contains ₹${currentVal.toLocaleString('en-IN')}.\nDo you want to overwrite it with the calculated amount ₹${calculatedAmount.toLocaleString('en-IN')}?`,
              confirmText: 'Overwrite',
              cancelText: 'Keep Existing'
            });
            if (!confirmed) return;
          }
        }

        // Apply
        if (targetEl) {
          targetEl.value = calculatedAmount;
          // Dispatch change & input events so any listeners re-evaluate
          targetEl.dispatchEvent(new Event('input', { bubbles: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (typeof onApply === 'function') {
          onApply(calculatedAmount);
        }

        overlay.remove();
      };
    }
  }

  document.body.appendChild(overlay);
  render();
}
