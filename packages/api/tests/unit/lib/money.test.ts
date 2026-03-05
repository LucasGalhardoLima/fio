import { describe, it, expect } from 'vitest'
import {
  centavosToDecimal,
  decimalToCentavos,
  validateCentavos,
} from '../../../src/lib/money.js'

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
})
