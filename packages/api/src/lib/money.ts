import { ValidationError } from './errors.js'

/**
 * Convert centavos (integer) to decimal string with 2 decimal places.
 * Used at the Efi API boundary where values must be in reais.
 *
 * Example: 4990 -> "49.90"
 */
export function centavosToDecimal(centavos: number): string {
  validateCentavos(centavos)
  const reais = Math.floor(centavos / 100)
  const cents = centavos % 100
  return `${reais}.${cents.toString().padStart(2, '0')}`
}

/**
 * Convert decimal string (reais) to centavos integer.
 * Used at the Efi API boundary where values arrive as strings.
 *
 * Example: "49.90" -> 4990
 */
export function decimalToCentavos(decimal: string): number {
  const trimmed = decimal.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new ValidationError(
      `Invalid decimal money format: "${decimal}". Expected format: "49.90"`,
      [{ field: 'amount', message: 'Value must be a non-negative number with up to 2 decimal places' }],
    )
  }

  const parts = trimmed.split('.')
  const integerPart = parts[0] ?? '0'
  const decimalPart = (parts[1] ?? '').padEnd(2, '0')

  const centavos = Number(integerPart) * 100 + Number(decimalPart)

  if (!Number.isFinite(centavos) || centavos < 0) {
    throw new ValidationError(
      `Invalid decimal money value: "${decimal}"`,
      [{ field: 'amount', message: 'Computed centavos must be a non-negative finite number' }],
    )
  }

  return centavos
}

/**
 * Validate that a centavos amount is a positive integer.
 * All money values in the system must be positive integers (centavos).
 */
export function validateCentavos(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new ValidationError(
      `Amount must be an integer (centavos), received: ${amount}`,
      [{ field: 'amount', message: 'Money values must be integers representing centavos' }],
    )
  }

  if (amount <= 0) {
    throw new ValidationError(
      `Amount must be a positive integer (centavos), received: ${amount}`,
      [{ field: 'amount', message: 'Money values must be positive' }],
    )
  }
}
