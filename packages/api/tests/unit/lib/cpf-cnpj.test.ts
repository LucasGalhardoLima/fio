import { describe, it, expect } from 'vitest'
import {
  validateCpf,
  validateCnpj,
  validateTaxId,
  formatCpf,
  formatCnpj,
  stripTaxId,
} from '../../../src/lib/cpf-cnpj.js'

describe('CPF validation', () => {
  it('accepts a valid CPF (52998224725)', () => {
    expect(validateCpf('52998224725')).toBe(true)
  })

  it('rejects an invalid CPF (12345678901 — wrong check digits)', () => {
    expect(validateCpf('12345678901')).toBe(false)
  })

  it('rejects CPF with all same digits', () => {
    expect(validateCpf('11111111111')).toBe(false)
  })

  it('rejects CPF with wrong length', () => {
    expect(validateCpf('1234')).toBe(false)
    expect(validateCpf('123456789012')).toBe(false)
  })

  it('validates CPF with formatting (529.982.247-25)', () => {
    expect(validateCpf('529.982.247-25')).toBe(true)
  })
})

describe('CNPJ validation', () => {
  it('accepts a valid CNPJ (11222333000181)', () => {
    expect(validateCnpj('11222333000181')).toBe(true)
  })

  it('rejects an invalid CNPJ (11222333000199 — wrong check digits)', () => {
    expect(validateCnpj('11222333000199')).toBe(false)
  })

  it('rejects CNPJ with all same digits', () => {
    expect(validateCnpj('11111111111111')).toBe(false)
  })

  it('rejects CNPJ with wrong length', () => {
    expect(validateCnpj('12345')).toBe(false)
  })

  it('validates CNPJ with formatting (11.222.333/0001-81)', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true)
  })
})

describe('formatCpf', () => {
  it('formats a raw CPF string', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })
})

describe('formatCnpj', () => {
  it('formats a raw CNPJ string', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })
})

describe('stripTaxId', () => {
  it('removes all non-digit characters', () => {
    expect(stripTaxId('529.982.247-25')).toBe('52998224725')
    expect(stripTaxId('11.222.333/0001-81')).toBe('11222333000181')
    expect(stripTaxId('abc123def456')).toBe('123456')
  })
})

describe('validateTaxId', () => {
  it('delegates to validateCpf when type is cpf', () => {
    expect(validateTaxId('52998224725', 'cpf')).toBe(true)
    expect(validateTaxId('12345678901', 'cpf')).toBe(false)
  })

  it('delegates to validateCnpj when type is cnpj', () => {
    expect(validateTaxId('11222333000181', 'cnpj')).toBe(true)
    expect(validateTaxId('11222333000199', 'cnpj')).toBe(false)
  })

  it('strips formatting before validating', () => {
    expect(validateTaxId('529.982.247-25', 'cpf')).toBe(true)
    expect(validateTaxId('11.222.333/0001-81', 'cnpj')).toBe(true)
  })
})
