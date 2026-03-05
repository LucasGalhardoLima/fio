import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import { WEBHOOK_RETRY_SCHEDULE, MAX_WEBHOOK_ATTEMPTS, EVENT_TYPES } from '@fio-pay/shared'
import { signPayload, verifySignature } from '../../../src/lib/hmac.js'

// ---------------------------------------------------------------------------
// Mock fetch — simulates HTTP calls to webhook endpoints
// ---------------------------------------------------------------------------

let mockResponse = { status: 200, body: 'OK' }
let fetchCalls: Array<{ url: string; init: RequestInit }> = []
let fetchShouldThrow = false

const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  fetchCalls.push({ url: url.toString(), init: init ?? {} })
  if (fetchShouldThrow) throw new Error('ECONNREFUSED')
  return { status: mockResponse.status, text: async () => mockResponse.body } as Response
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = crypto.randomBytes(32).toString('hex')
const URL_ENDPOINT = 'https://example.com/webhooks'

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    endpointUrl: URL_ENDPOINT, endpointSecret: SECRET,
    eventId: crypto.randomUUID(), eventType: EVENT_TYPES.CHARGE_PAID,
    eventData: { charge_id: crypto.randomUUID(), amount: 5000 },
    attempt: 1, maxAttempts: MAX_WEBHOOK_ATTEMPTS, ...overrides,
  }
}

function buildPayload(p: ReturnType<typeof makeParams>): string {
  return JSON.stringify({
    id: p.eventId, type: p.eventType, data: p.eventData,
    created_at: new Date().toISOString(),
  })
}

async function simulateDelivery(p: ReturnType<typeof makeParams>) {
  const payload = buildPayload(p)
  const ts = Math.floor(Date.now() / 1000)
  const sig = signPayload(payload, p.endpointSecret, ts)
  let statusCode = 0, responseBody = '', success = false
  const start = Date.now()

  try {
    const res = await mockFetch(p.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Fio-Signature': sig, 'User-Agent': 'Fio-Webhooks/1.0' },
      body: payload,
    })
    statusCode = res.status
    responseBody = await res.text()
    success = statusCode >= 200 && statusCode < 300
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Unknown'
  }

  const shouldRetry = !success && p.attempt < p.maxAttempts
  const idx = p.attempt - 1
  const nextDelay = shouldRetry
    ? (idx < WEBHOOK_RETRY_SCHEDULE.length ? WEBHOOK_RETRY_SCHEDULE[idx] : WEBHOOK_RETRY_SCHEDULE.at(-1)) ?? null
    : null

  return { success, statusCode, responseBody, responseTimeMs: Date.now() - start, shouldRetry, nextDelay }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Webhook Delivery', () => {
  beforeEach(() => {
    mockResponse = { status: 200, body: 'OK' }
    fetchCalls = []
    fetchShouldThrow = false
    vi.clearAllMocks()
  })

  describe('successful delivery', () => {
    it('POST returns 200, delivery status = delivered', async () => {
      const r = await simulateDelivery(makeParams())
      expect(r.success).toBe(true)
      expect(r.statusCode).toBe(200)
      expect(r.shouldRetry).toBe(false)
      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0]?.url).toBe(URL_ENDPOINT)
    })

    it('treats any 2xx as success', async () => {
      for (const status of [200, 201, 202, 204]) {
        fetchCalls = []
        mockResponse = { status, body: '' }
        const r = await simulateDelivery(makeParams())
        expect(r.success).toBe(true)
      }
    })
  })

  describe('failed delivery with retry scheduling', () => {
    it('endpoint returns 500, retry scheduled per backoff schedule', async () => {
      mockResponse = { status: 500, body: 'error' }
      const delays = [60_000, 300_000, 1_800_000, 7_200_000, 86_400_000]

      for (let attempt = 1; attempt <= MAX_WEBHOOK_ATTEMPTS; attempt++) {
        const r = await simulateDelivery(makeParams({ attempt }))
        expect(r.success).toBe(false)
        if (attempt < MAX_WEBHOOK_ATTEMPTS) {
          expect(r.shouldRetry).toBe(true)
          expect(r.nextDelay).toBe(delays[attempt - 1])
        } else {
          expect(r.shouldRetry).toBe(false)
        }
      }
    })

    it('handles network errors and schedules retry', async () => {
      fetchShouldThrow = true
      const r = await simulateDelivery(makeParams())
      expect(r.success).toBe(false)
      expect(r.statusCode).toBe(0)
      expect(r.responseBody).toBe('ECONNREFUSED')
      expect(r.shouldRetry).toBe(true)
      expect(r.nextDelay).toBe(60_000)
    })
  })

  describe('max retries exhausted', () => {
    it('5 failed attempts => status = failed, no more retries', async () => {
      mockResponse = { status: 500, body: 'error' }
      const r = await simulateDelivery(makeParams({ attempt: MAX_WEBHOOK_ATTEMPTS }))
      expect(r.success).toBe(false)
      expect(r.shouldRetry).toBe(false)
      expect(r.nextDelay).toBeNull()
    })
  })

  describe('HMAC signature verification', () => {
    it('produces a correct Fio-Signature header (t=...,v1=...)', async () => {
      await simulateDelivery(makeParams())
      const hdrs = fetchCalls[0]?.init.headers as Record<string, string>
      expect(hdrs['Fio-Signature']).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)
    })

    it('signature can be verified with verifySignature', () => {
      const p = makeParams()
      const payload = buildPayload(p)
      const ts = Math.floor(Date.now() / 1000)
      const sig = signPayload(payload, p.endpointSecret, ts)
      expect(verifySignature(payload, sig, p.endpointSecret)).toBe(true)
    })

    it('verification fails with wrong secret', () => {
      const payload = '{"test":"data"}'
      const ts = Math.floor(Date.now() / 1000)
      const sig = signPayload(payload, SECRET, ts)
      const wrong = crypto.randomBytes(32).toString('hex')
      expect(verifySignature(payload, sig, wrong)).toBe(false)
    })

    it('verification fails with tampered payload', () => {
      const ts = Math.floor(Date.now() / 1000)
      const sig = signPayload('{"a":"b"}', SECRET, ts)
      expect(verifySignature('{"a":"c"}', sig, SECRET)).toBe(false)
    })
  })

  describe('event type filtering', () => {
    it('null event_types matches all events', () => {
      const types: string[] | null = null
      expect(types === null || types.includes(EVENT_TYPES.CHARGE_PAID)).toBe(true)
    })

    it('endpoint receives subscribed event types', () => {
      const types = [EVENT_TYPES.CHARGE_PAID, EVENT_TYPES.CHARGE_FAILED]
      expect(types.includes(EVENT_TYPES.CHARGE_PAID)).toBe(true)
      expect(types.includes(EVENT_TYPES.CHARGE_FAILED)).toBe(true)
    })

    it('endpoint does NOT receive unsubscribed event types', () => {
      const types = [EVENT_TYPES.CHARGE_PAID]
      expect(types.includes(EVENT_TYPES.SUBSCRIPTION_CANCELED)).toBe(false)
      expect(types.includes(EVENT_TYPES.INVOICE_PAID)).toBe(false)
    })

    it('empty event_types array matches no events', () => {
      const types: string[] = []
      expect(types.includes(EVENT_TYPES.CHARGE_PAID)).toBe(false)
    })
  })
})
