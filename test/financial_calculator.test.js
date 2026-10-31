import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { QuickCalcEngine } from '../public/js/components/quickCalculator.js';

describe('DDevUltraHome — Quick Financial Calculator Engine', () => {

  test('calculates Quantity × Rate with precision and boundary checks', () => {
    // 1. Example from prompt: 12 × ₹450 = ₹5,400
    const res1 = QuickCalcEngine.calculateQtyRate(12, 450);
    assert.equal(res1, 5400.00);

    // 2. Decimals: 25.5 bags @ ₹385.50
    const res2 = QuickCalcEngine.calculateQtyRate(25.5, 385.50);
    assert.equal(res2, 9830.25);

    // 3. Zero or negative handling
    assert.equal(QuickCalcEngine.calculateQtyRate(0, 500), 0.00);
    assert.equal(QuickCalcEngine.calculateQtyRate(-5, 500), 0.00);
    assert.equal(QuickCalcEngine.calculateQtyRate(10, -50), 0.00);
  });

  test('calculates multiple line-item totals', () => {
    const items = [
      { qty: 50, rate: 380 },  // 19000
      { qty: 2, rate: 4500 },  // 9000
      { qty: 150, rate: 68 }   // 10200
    ];

    const total = QuickCalcEngine.calculateLineItems(items);
    assert.equal(total, 38200.00);
  });

  test('calculates percentage and flat discounts accurately', () => {
    // 1. 5% discount on ₹50,000 = ₹2,500
    const disc1 = QuickCalcEngine.calculateDiscount(50000, 'PERCENT', 5);
    assert.equal(disc1, 2500.00);

    // 2. Flat discount of ₹1,200 on ₹10,000 = ₹1,200
    const disc2 = QuickCalcEngine.calculateDiscount(10000, 'FLAT', 1200);
    assert.equal(disc2, 1200.00);

    // 3. Flat discount cannot exceed base amount
    const disc3 = QuickCalcEngine.calculateDiscount(1000, 'FLAT', 1500);
    assert.equal(disc3, 1000.00);
  });

  test('calculates GST tax percentage and tax amount', () => {
    // 1. Standard 18% GST on ₹1,00,000
    const tax1 = QuickCalcEngine.calculateTax(100000, 18);
    assert.equal(tax1, 18000.00);

    // 2. 5% GST on ₹20,000
    const tax2 = QuickCalcEngine.calculateTax(20000, 5);
    assert.equal(tax2, 1000.00);

    // 3. 0% GST
    const tax3 = QuickCalcEngine.calculateTax(50000, 0);
    assert.equal(tax3, 0.00);
  });

  test('evaluates arithmetic expressions with division by zero guard', () => {
    // 1. Basic arithmetic: 1500 + 350 * 4
    assert.equal(QuickCalcEngine.evaluateExpression('1500 + 350 * 4'), 2900.00);

    // 2. Parentheses: (1200 + 800) * 1.5
    assert.equal(QuickCalcEngine.evaluateExpression('(1200 + 800) * 1.5'), 3000.00);

    // 3. Division: 7500 / 3
    assert.equal(QuickCalcEngine.evaluateExpression('7500 / 3'), 2500.00);

    // 4. Division by zero must throw an error
    assert.throws(() => {
      QuickCalcEngine.evaluateExpression('5000 / 0');
    }, /Division by zero/);

    // 5. Malicious or invalid expressions must be rejected safely
    assert.throws(() => {
      QuickCalcEngine.evaluateExpression('alert("hack")');
    }, /Invalid characters/);
  });

  test('computes complete financial breakdown with discount, tax and round-off', () => {
    const items = [
      { qty: 10, rate: 450 }, // 4500
      { qty: 2, rate: 1250 }  // 2500
    ]; // Subtotal = 7000

    const breakdown = QuickCalcEngine.computeBreakdown({
      items,
      discountType: 'PERCENT',
      discountValue: 10, // ₹700 off -> 6300
      taxPercent: 18,    // 18% of 6300 = 1134 -> 7434
      shouldRoundOff: true
    });

    assert.equal(breakdown.subtotal, 7000.00);
    assert.equal(breakdown.discountAmount, 700.00);
    assert.equal(breakdown.taxableAmount, 6300.00);
    assert.equal(breakdown.taxAmount, 1134.00);
    assert.equal(breakdown.finalTotal, 7434.00);
  });
});
