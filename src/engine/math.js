/**
 * DDevUltraHome Decimal-Safe Math, Units & Validation Library
 * Tamil Nadu Civil Engineering & Construction Standard
 */

export class SafeMath {
  /**
   * Safely rounds a number to specified decimal places without floating point artifacts
   */
  static round(val, decimals = 2) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
  }

  static add(...nums) {
    const sum = nums.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    return this.round(sum, 4);
  }

  static sub(a, b) {
    return this.round((Number(a) || 0) - (Number(b) || 0), 4);
  }

  static mul(...nums) {
    const product = nums.reduce((acc, curr) => acc * (Number(curr) || 0), 1);
    return this.round(product, 4);
  }

  static div(a, b, decimals = 4) {
    const divisor = Number(b);
    if (!divisor || isNaN(divisor)) {
      throw new Error('Division by zero or invalid divisor');
    }
    return this.round((Number(a) || 0) / divisor, decimals);
  }

  /**
   * Indian Currency Formatter (e.g., ₹ 1,25,000.50)
   */
  static formatINR(val, includeSymbol = true) {
    const num = Number(val) || 0;
    const isNegative = num < 0;
    const absVal = Math.abs(num);
    const parts = absVal.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];

    if (intPart.length > 3) {
      const lastThree = intPart.substring(intPart.length - 3);
      const remaining = intPart.substring(0, intPart.length - 3);
      const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      intPart = formattedRemaining + ',' + lastThree;
    }

    const sign = isNegative ? '-' : '';
    const symbol = includeSymbol ? '₹ ' : '';
    return `${sign}${symbol}${intPart}.${decPart}`;
  }
}

/**
 * Standard Unit Conversion Factors for Tamil Nadu Construction & Land Measurement
 */
export const UnitFactors = {
  // Base unit: Meter (m)
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1.0,
    inch: 0.0254,
    ft: 0.3048,
    yard: 0.9144
  },
  // Base unit: Square Meter (sq.m / m²)
  area: {
    sqmm: 0.000001,
    sqm: 1.0,
    sqft: 0.09290304,
    sqyd: 0.83612736,
    cent: 40.468564224,     // 1 Cent = 435.6 sq.ft = 40.46856 m²
    ground: 222.967296,     // 1 Ground = 2400 sq.ft = 222.967 m² (TN standard)
    ankanam: 6.68901888,    // 1 Ankanam = 72 sq.ft = 6.689 m²
    guntha: 101.17141056,   // 1 Guntha = 1089 sq.ft = 101.171 m²
    acre: 4046.8564224,     // 1 Acre = 100 Cents = 43560 sq.ft = 4046.856 m²
    ares: 100.0,            // 1 Ares = 100 sq.m = 1076.39 sq.ft
    hectare: 10000.0        // 1 Hectare = 10000 sq.m = 2.471 Acres
  },
  // Base unit: Cubic Meter (cu.m / m³)
  volume: {
    cum: 1.0,
    cft: 0.028316846592,    // 1 m³ = 35.3146667 cft
    unit: 2.8316846592,     // 1 TN Unit (Brass) = 100 cft = 2.83168 m³
    litre: 0.001            // 1000 Litres = 1 m³
  },
  // Base unit: Kilogram (kg)
  mass: {
    kg: 1.0,
    quintal: 100.0,
    tonne: 1000.0,
    mt: 1000.0,
    g: 0.001
  }
};

export class UnitConverter {
  static convert(value, type, fromUnit, toUnit) {
    const val = Number(value);
    if (isNaN(val)) throw new Error(`Invalid numeric value: ${value}`);
    if (val === 0) return 0;

    const group = UnitFactors[type];
    if (!group) throw new Error(`Unknown unit type: ${type}`);

    const fUnit = fromUnit.toLowerCase();
    const tUnit = toUnit.toLowerCase();

    if (!group[fUnit]) throw new Error(`Unknown source unit '${fromUnit}' for type '${type}'`);
    if (!group[tUnit]) throw new Error(`Unknown destination unit '${toUnit}' for type '${type}'`);

    const inBase = val * group[fUnit];
    const converted = inBase / group[tUnit];
    return SafeMath.round(converted, 6);
  }

  static convertLength(value, from, to) {
    return this.convert(value, 'length', from, to);
  }

  static convertArea(value, from, to) {
    return this.convert(value, 'area', from, to);
  }

  static convertVolume(value, from, to) {
    return this.convert(value, 'volume', from, to);
  }

  static convertMass(value, from, to) {
    return this.convert(value, 'mass', from, to);
  }
}

/**
 * Validation helpers for civil engineering parameters
 */
export class Validator {
  static positiveNumber(fieldName, value, allowZero = false) {
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `${fieldName} is required.` };
    }
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: `${fieldName} must be a valid number.` };
    }
    if (allowZero ? num < 0 : num <= 0) {
      return { valid: false, error: `${fieldName} must be ${allowZero ? 'greater than or equal to 0' : 'greater than 0'}.` };
    }
    return { valid: true, value: num };
  }

  static inRange(fieldName, value, min, max) {
    const res = this.positiveNumber(fieldName, value, true);
    if (!res.valid) return res;
    if (res.value < min || res.value > max) {
      return { valid: false, error: `${fieldName} must be between ${min} and ${max}.` };
    }
    return { valid: true, value: res.value };
  }
}
