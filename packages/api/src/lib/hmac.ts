import crypto from 'node:crypto'

/**
 * Sign a webhook payload with HMAC-SHA256.
 *
 * Returns a signature header in the format: t={timestamp},v1={hex_signature}
 * The signed content is "{timestamp}.{payload}" to bind the timestamp to the payload.
 */
export function signPayload(payload: string, secret: string, timestamp: number): string {
  const signedContent = `${timestamp}.${payload}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex')

  return `t=${timestamp},v1=${signature}`
}

interface ParsedSignature {
  timestamp: number
  signature: string
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  let timestamp: number | undefined
  let signature: string | undefined

  const parts = header.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith('t=')) {
      const value = Number(trimmed.slice(2))
      if (Number.isFinite(value)) {
        timestamp = value
      }
    } else if (trimmed.startsWith('v1=')) {
      signature = trimmed.slice(3)
    }
  }

  if (timestamp === undefined || signature === undefined || signature.length === 0) {
    return null
  }

  return { timestamp, signature }
}

const DEFAULT_TOLERANCE_SECONDS = 300

/**
 * Verify a webhook signature header against a payload and secret.
 *
 * Checks that:
 * 1. The header can be parsed (t= and v1= fields)
 * 2. The HMAC-SHA256 signature matches
 * 3. The timestamp is within the tolerance window (default 300 seconds)
 */
export function verifySignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  const parsed = parseSignatureHeader(signatureHeader)
  if (parsed === null) {
    return false
  }

  const signedContent = `${parsed.timestamp}.${payload}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const receivedBuffer = Buffer.from(parsed.signature, 'hex')

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return false
  }

  // Check timestamp tolerance
  const nowSeconds = Math.floor(Date.now() / 1000)
  const age = nowSeconds - parsed.timestamp
  if (age > toleranceSeconds) {
    return false
  }

  return true
}
