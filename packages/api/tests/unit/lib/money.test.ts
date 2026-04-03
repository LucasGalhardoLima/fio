import { describe, it, expect } from 'vitest'
import {
  centavosToDecimal,
  decimalToCentavos,
  validateCentavos,
} from '../../../src/lib/money.js'
import { MIN_CHARGE_AMOUNT } from '@fio-pay/shared'

describe('centavosToDecimal', () => {
  it('converts 4990 centavos to "49.90"', () => {
    expect(centavosToDecimal(4990)).toBe('49.90')
  })

  it('converts 100 centavos to "1.00"', () => {
    expect(centavosToDecimal(100)).toBe('1.00')
  })

  it('converts 1 centavo to "0.01"', () => {
    expect(centavosToDecimal(1)).toBe('0.01')
  })

  it('converts large amounts correctly', () => {
    expect(centavosToDecimal(1_000_000)).toBe('10000.00')
  })

  it('converts maximum practical amount (9_999_999_999)', () => {
    expect(centavosToDecimal(9_999_999_999)).toBe('99999999.99')
  })

  it('converts R$10M (1_000_000_000 centavos)', () => {
    expect(centavosToDecimal(1_000_000_000)).toBe('10000000.00')
  })

  it('converts amount just below MAX_SAFE_INTEGER', () => {
    expect(centavosToDecimal(Number.MAX_SAFE_INTEGER - 1)).toBe('90071992547409.90')
  })
})

describe('decimalToCentavos', () => {
  it('converts "49.90" to 4990', () => {
    expect(decimalToCentavos('49.90')).toBe(4990)
  })

  it('converts "1.00" to 100', () => {
    expect(decimalToCentavos('1.00')).toBe(100)
  })

  it('converts "0.01" to 1', () => {
    expect(decimalToCentavos('0.01')).toBe(1)
  })

  it('handles whole numbers without decimal part', () => {
    expect(decimalToCentavos('10')).toBe(1000)
  })

  it('converts large decimal "99999999.99" to 9_999_999_999', () => {
    expect(decimalToCentavos('99999999.99')).toBe(9_999_999_999)
  })

  it('round-trips large amount through centavosToDecimal and back', () => {
    const decimal = centavosToDecimal(9_999_999_999)
    expect(decimalToCentavos(decimal)).toBe(9_999_999_999)
  })

  it('throws for invalid format "abc"', () => {
    expect(() => decimalToCentavos('abc')).toThrow(/Invalid decimal money format/)
  })

  it('throws for too many decimal places "12.345"', () => {
    expect(() => decimalToCentavos('12.345')).toThrow(/Invalid decimal money format/)
  })

  it('throws for negative decimal "-10.00"', () => {
    expect(() => decimalToCentavos('-10.00')).toThrow(/Invalid decimal money format/)
  })

  it('throws for empty string', () => {
    expect(() => decimalToCentavos('')).toThrow(/Invalid decimal money format/)
  })

  it('converts single decimal place "10.5" to 1050', () => {
    expect(decimalToCentavos('10.5')).toBe(1050)
  })
})

describe('validateCentavos', () => {
  it('accepts a valid positive integer (100)', () => {
    expect(() => validateCentavos(100)).not.toThrow()
  })

  it('throws for zero', () => {
    expect(() => validateCentavos(0)).toThrow(/positive/)
  })

  it('throws for negative values', () => {
    expect(() => validateCentavos(-1)).toThrow(/positive/)
  })

  it('throws for non-integer values (1.5)', () => {
    expect(() => validateCentavos(1.5)).toThrow(/integer/)
  })

  it('throws for NaN', () => {
    expect(() => validateCentavos(NaN)).toThrow(/integer/)
  })

  it('accepts MIN_CHARGE_AMOUNT (100)', () => {
    expect(() => validateCentavos(MIN_CHARGE_AMOUNT)).not.toThrow()
  })

  it('accepts large valid amount (9_999_999_999)', () => {
    expect(() => validateCentavos(9_999_999_999)).not.toThrow()
  })

  it('throws for Infinity', () => {
    expect(() => validateCentavos(Infinity)).toThrow(/integer/)
  })
})
