import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Event } from '@fio-pay/shared'

const TIMESTAMP_TOLERANCE_SECONDS = 300

export interface WebhookVerifyOptions {
  tolerance?: number
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  options?: WebhookVerifyOptions,
): Event {
  const tolerance = options?.tolerance ?? TIMESTAMP_TOLERANCE_SECONDS

  const parts = signature.split(',')
  const timestampPart = parts.find((p) => p.startsWith('t='))
  const signaturePart = parts.find((p) => p.startsWith('v1='))

  if (!timestampPart || !signaturePart) {
    throw new Error('Invalid Fio-Signature header format. Expected: t={timestamp},v1={signature}')
  }

  const timestamp = parseInt(timestampPart.slice(2), 10)
  const receivedSignature = signaturePart.slice(3)

  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp in Fio-Signature header')
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > tolerance) {
    throw new Error(
      `Webhook timestamp too old. Received: ${timestamp}, current: ${now}, tolerance: ${tolerance}s`,
    )
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const receivedBuffer = Buffer.from(receivedSignature, 'hex')

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error('Invalid webhook signature')
  }

  return JSON.parse(rawBody) as Event
}
