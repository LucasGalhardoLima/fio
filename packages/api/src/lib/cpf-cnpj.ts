import { ValidationError } from './errors.js'

export function stripTaxId(value: string): string {
  return value.replace(/\D/g, '')
}

function isAllSameDigit(digits: string): boolean {
  const first = digits[0]
  if (first === undefined) return true
  return digits.split('').every((d) => d === first)
}

function computeCpfCheckDigit(digits: string, length: number): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i)
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function validateCpf(value: string): boolean {
  const digits = stripTaxId(value)

  if (digits.length !== 11) {
    return false
  }

  if (isAllSameDigit(digits)) {
    return false
  }

  const firstCheck = computeCpfCheckDigit(digits, 9)
  if (Number(digits[9]) !== firstCheck) {
    return false
  }

  const secondCheck = computeCpfCheckDigit(digits, 10)
  if (Number(digits[10]) !== secondCheck) {
    return false
  }

  return true
}

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

function computeCnpjCheckDigit(digits: string, weights: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    const digit = Number(digits[i])
    const weight = weights[i]
    if (weight !== undefined) {
      sum += digit * weight
    }
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function validateCnpj(value: string): boolean {
  const digits = stripTaxId(value)

  if (digits.length !== 14) {
    return false
  }

  if (isAllSameDigit(digits)) {
    return false
  }

  const firstCheck = computeCnpjCheckDigit(digits, CNPJ_FIRST_WEIGHTS)
  if (Number(digits[12]) !== firstCheck) {
    return false
  }

  const secondCheck = computeCnpjCheckDigit(digits, CNPJ_SECOND_WEIGHTS)
  if (Number(digits[13]) !== secondCheck) {
    return false
  }

  return true
}

export function validateTaxId(value: string, type: 'cpf' | 'cnpj'): boolean {
  if (type === 'cpf') {
    return validateCpf(value)
  }
  return validateCnpj(value)
}

export function assertValidCpf(value: string): void {
  if (!validateCpf(value)) {
    throw new ValidationError(
      'Invalid CPF format. Expected: 123.456.789-00 or 12345678900',
      [{ field: 'tax_id', message: 'Invalid CPF check digits or length' }],
    )
  }
}

export function assertValidCnpj(value: string): void {
  if (!validateCnpj(value)) {
    throw new ValidationError(
      'Invalid CNPJ format. Expected: 12.345.678/0001-90 or 12345678000190',
      [{ field: 'tax_id', message: 'Invalid CNPJ check digits or length' }],
    )
  }
}

export function formatCpf(digits: string): string {
  const d = stripTaxId(digits)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

export function formatCnpj(digits: string): string {
  const d = stripTaxId(digits)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}
