const PII_FIELDS = new Set(['email', 'tax_id', 'cpf', 'cnpj'])

/**
 * Mask a CPF, revealing only the last 5 characters.
 * Example: "123.456.789-09" -> "***.***.789-09"
 */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) {
    return '***'
  }
  return `***.***${cpf.slice(cpf.length - 6)}`
}

/**
 * Mask a CNPJ, revealing only the last 6 characters.
 * Example: "12.345.678/0001-90" -> "**.***.***\/0001-90"
 */
export function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) {
    return '***'
  }
  return `**.***.***/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Mask an email address, showing only the first character and domain.
 * Example: "john@example.com" -> "j***@example.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) {
    return '***'
  }
  const firstChar = email[0]
  const domain = email.slice(atIndex)
  return `${firstChar}***${domain}`
}

function maskValue(key: string, value: string): string {
  switch (key) {
    case 'email':
      return maskEmail(value)
    case 'cpf':
      return maskCpf(value)
    case 'cnpj':
      return maskCnpj(value)
    case 'tax_id': {
      const digits = value.replace(/\D/g, '')
      if (digits.length === 11) {
        return maskCpf(value)
      }
      if (digits.length === 14) {
        return maskCnpj(value)
      }
      return '***'
    }
    default:
      return value
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function maskRecursive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.has(key) && typeof value === 'string') {
      result[key] = maskValue(key, value)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        isPlainObject(item) ? maskRecursive(item) : item,
      )
    } else if (isPlainObject(value)) {
      result[key] = maskRecursive(value)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Deep-clone an object and mask known PII fields (email, tax_id, cpf, cnpj).
 */
export function maskPii(obj: Record<string, unknown>): Record<string, unknown> {
  return maskRecursive(obj)
}
