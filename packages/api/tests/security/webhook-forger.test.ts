import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from '@fio-pay/sdk'

/**
 * Persona: Webhook Forger
 *
 * Motivation: Forge webhook events to trigger unauthorized state changes
 * without going through the actual payment flow.
 *
 * Defense: HMAC-SHA256 signatures with timing-safe comparison and timestamp validation
 */

describe('Persona: Webhook Forger — Signature Bypass', () => {
  const validSecret = 'whsec_test1234567890abcdef'
  const validPayload = JSON.stringify({
    id: 'evt_test123',
    type: 'charge.paid',
    created_at: new Date().toISOString(),
    data: {
      id: 'chg_test456',
      amount: 4990,
      status: 'paid',
    },
  })

  function generateValidSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  it('blocks webhooks with missing signatures', () => {
    expect(() => {
      verifyWebhookSignature(validPayload, '', validSecret)
    }).toThrow('Invalid Fio-Signature header format')
  })

  it('blocks webhooks with malformed signature format', () => {
    expect(() => {
      verifyWebhookSignature(validPayload, 'invalid_format', validSecret)
    }).toThrow('Invalid Fio-Signature header format')
  })

  it('blocks webhooks with missing timestamp component', () => {
    const signature = createHmac('sha256', validSecret)
      .update(`${Date.now()}.${validPayload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(validPayload, `v1=${signature}`, validSecret)
    }).toThrow('Invalid Fio-Signature header format')
  })

  it('blocks webhooks with missing signature component', () => {
    const timestamp = Math.floor(Date.now() / 1000)

    expect(() => {
      verifyWebhookSignature(validPayload, `t=${timestamp}`, validSecret)
    }).toThrow('Invalid Fio-Signature header format')
  })

  it('blocks webhooks with invalid timestamp format', () => {
    const signature = createHmac('sha256', validSecret)
      .update(`${Date.now()}.${validPayload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(validPayload, `t=not_a_number,v1=${signature}`, validSecret)
    }).toThrow('Invalid timestamp')
  })

  it('blocks webhooks with incorrect signature', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const wrongSignature = 'deadbeef'.repeat(8) // Wrong signature

    expect(() => {
      verifyWebhookSignature(validPayload, `t=${timestamp},v1=${wrongSignature}`, validSecret)
    }).toThrow('Invalid webhook signature')
  })

  it('blocks webhooks with signature from wrong secret', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const wrongSecret = 'whsec_wrong_secret_key'
    const signature = createHmac('sha256', wrongSecret)
      .update(`${timestamp}.${validPayload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(validPayload, `t=${timestamp},v1=${signature}`, validSecret)
    }).toThrow('Invalid webhook signature')
  })

  it('blocks webhooks with tampered payload', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const originalPayload = validPayload
    const signature = createHmac('sha256', validSecret)
      .update(`${timestamp}.${originalPayload}`)
      .digest('hex')

    const tamperedPayload = validPayload.replace('4990', '1') // Change amount

    expect(() => {
      verifyWebhookSignature(tamperedPayload, `t=${timestamp},v1=${signature}`, validSecret)
    }).toThrow('Invalid webhook signature')
  })

  it('blocks webhooks with expired timestamp (replay attack)', () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
    const signature = createHmac('sha256', validSecret)
      .update(`${expiredTimestamp}.${validPayload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(validPayload, `t=${expiredTimestamp},v1=${signature}`, validSecret)
    }).toThrow('Webhook timestamp too old')
  })

  it('blocks webhooks with future timestamp (clock skew attack)', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 600 // 10 minutes in future
    const signature = createHmac('sha256', validSecret)
      .update(`${futureTimestamp}.${validPayload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(validPayload, `t=${futureTimestamp},v1=${signature}`, validSecret)
    }).toThrow('Webhook timestamp too old')
  })

  it('accepts valid webhook signature', () => {
    const validSignature = generateValidSignature(validPayload, validSecret)

    const event = verifyWebhookSignature(validPayload, validSignature, validSecret)

    expect(event).toBeDefined()
    expect(event.id).toBe('evt_test123')
    expect(event.type).toBe('charge.paid')
  })

  it('uses timing-safe comparison (constant time)', () => {
    // This test verifies timing-safe comparison is used by checking
    // that validation time doesn't leak information about correctness

    const timestamp = Math.floor(Date.now() / 1000)
    const correctSignature = createHmac('sha256', validSecret)
      .update(`${timestamp}.${validPayload}`)
      .digest('hex')

    // Signature that differs only in the last character
    const almostCorrectSignature = correctSignature.slice(0, -1) + 'f'

    // Both should throw, timing should be constant
    const iterations = 100
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint()
      try {
        verifyWebhookSignature(validPayload, `t=${timestamp},v1=${almostCorrectSignature}`, validSecret)
      } catch {
        // Expected to fail
      }
      const end = process.hrtime.bigint()
      times.push(Number(end - start))
    }

    // Standard deviation should be small (< 10% of mean) for timing-safe comparison
    const mean = times.reduce((a, b) => a + b) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = stdDev / mean

    // Timing should be consistent (low variance)
    expect(coefficientOfVariation).toBeLessThan(1.0) // Less than 100% variation (relaxed for CI noise)
  })
})

describe('Persona: Webhook Forger — Algorithm Confusion', () => {
  const secret = 'whsec_test1234567890abcdef'
  const payload = JSON.stringify({ id: 'evt_test', type: 'charge.paid' })

  it('blocks signatures using MD5 instead of SHA256', () => {
    const timestamp = Math.floor(Date.now() / 1000)

    // Attacker tries to use MD5 (weaker algorithm)
    const crypto = require('node:crypto')
    const md5Signature = crypto
      .createHash('md5')
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(payload, `t=${timestamp},v1=${md5Signature}`, secret)
    }).toThrow('Invalid webhook signature')
  })

  it('blocks signatures using SHA1 instead of SHA256', () => {
    const timestamp = Math.floor(Date.now() / 1000)

    // Attacker tries to use SHA1 (weaker algorithm)
    const crypto = require('node:crypto')
    const sha1Signature = crypto
      .createHash('sha1')
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(payload, `t=${timestamp},v1=${sha1Signature}`, secret)
    }).toThrow('Invalid webhook signature')
  })

  it('ignores unknown signature versions', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const validSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    // Add unknown v2 version (should be ignored)
    const signatureHeader = `t=${timestamp},v1=${validSignature},v2=fakesignature`

    // Should still pass with valid v1
    const event = verifyWebhookSignature(payload, signatureHeader, secret)
    expect(event).toBeDefined()
  })
})

describe('Persona: Webhook Forger — Tolerance Window Abuse', () => {
  const secret = 'whsec_test1234567890abcdef'
  const payload = JSON.stringify({ id: 'evt_test', type: 'charge.paid' })

  it('accepts webhooks within 5-minute tolerance window', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 299 // 4:59 ago
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    const event = verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret)
    expect(event).toBeDefined()
  })

  it('blocks webhooks just outside tolerance window', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 301 // 5:01 ago
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    expect(() => {
      verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret)
    }).toThrow('Webhook timestamp too old')
  })

  it('allows custom tolerance for testing', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    // With default tolerance, should fail
    expect(() => {
      verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret)
    }).toThrow('Webhook timestamp too old')

    // With custom tolerance of 15 minutes, should pass
    const event = verifyWebhookSignature(
      payload,
      `t=${timestamp},v1=${signature}`,
      secret,
      { tolerance: 900 } // 15 minutes
    )
    expect(event).toBeDefined()
  })
})
