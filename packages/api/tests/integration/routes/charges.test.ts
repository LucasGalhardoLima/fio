import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  createTestCustomer,
  cleanupDatabase,
} from '../../helpers/setup.js'
import { MIN_CHARGE_AMOUNT } from '@fio-pay/shared'

describe('Charges — /v1/charges', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let customerId: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)

    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey

    const customer = await createTestCustomer(db, account.id, 'test')
    customerId = customer.id
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  // -----------------------------------------------------------------------
  // POST /v1/charges
  // -----------------------------------------------------------------------

  describe('POST /v1/charges', () => {
    it('creates a charge and returns 201 with QR code data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: 5000,
        },
      })

      expect(response.statusCode).toBe(201)

      const body = response.json<{
        id: string
        status: string
        amount: number
        pix_qr_code: string | null
        pix_copy_paste: string | null
      }>()

      expect(body.id).toBeDefined()
      expect(body.status).toBe('pending')
      expect(body.amount).toBe(5000)
      // PIX QR code data should be present for a newly created charge
      expect(body.pix_qr_code).toBeDefined()
      expect(body.pix_copy_paste).toBeDefined()
    })

    it('enforces minimum amount and returns 422 for amounts below threshold', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: MIN_CHARGE_AMOUNT - 1,
        },
      })

      expect(response.statusCode).toBe(422)

      const body = response.json<{ type: string }>()
      expect(body.type).toBe('validation_error')
    })

    it('deduplicates requests with the same idempotency key', async () => {
      const idempotencyKey = `idem-${Date.now()}`

      const first = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          customer_id: customerId,
          amount: 2000,
        },
      })

      const second = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          customer_id: customerId,
          amount: 2000,
        },
      })

      expect(first.statusCode).toBe(201)
      expect(second.statusCode).toBe(201)

      const firstBody = first.json<{ id: string }>()
      const secondBody = second.json<{ id: string }>()
      expect(firstBody.id).toBe(secondBody.id)
    })

    it('applies custom expiration via expires_in', async () => {
      const expiresIn = 7200 // 2 hours

      const response = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: 3000,
          expires_in: expiresIn,
        },
      })

      expect(response.statusCode).toBe(201)

      const body = response.json<{ expires_at: string }>()
      expect(body.expires_at).toBeDefined()

      const expiresAt = new Date(body.expires_at).getTime()
      const now = Date.now()
      const diffSeconds = Math.round((expiresAt - now) / 1000)

      // Allow a tolerance of 30 seconds for test execution time
      expect(diffSeconds).toBeGreaterThan(expiresIn - 30)
      expect(diffSeconds).toBeLessThanOrEqual(expiresIn + 5)
    })

    it('uses default expiration of 3600 seconds when expires_in is omitted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: 4000,
        },
      })

      expect(response.statusCode).toBe(201)

      const body = response.json<{ expires_at: string }>()
      expect(body.expires_at).toBeDefined()

      const expiresAt = new Date(body.expires_at).getTime()
      const now = Date.now()
      const diffSeconds = Math.round((expiresAt - now) / 1000)

      const defaultExpiration = 3600
      expect(diffSeconds).toBeGreaterThan(defaultExpiration - 30)
      expect(diffSeconds).toBeLessThanOrEqual(defaultExpiration + 5)
    })
  })

  // -----------------------------------------------------------------------
  // GET /v1/charges/:id
  // -----------------------------------------------------------------------

  describe('GET /v1/charges/:id', () => {
    it('returns a charge with its status', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: 1500,
        },
      })

      const { id } = created.json<{ id: string }>()

      const response = await app.inject({
        method: 'GET',
        url: `/v1/charges/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json<{ id: string; status: string; amount: number }>()
      expect(body.id).toBe(id)
      expect(body.status).toBe('pending')
      expect(body.amount).toBe(1500)
    })
  })

  // -----------------------------------------------------------------------
  // GET /v1/charges (list)
  // -----------------------------------------------------------------------

  describe('GET /v1/charges', () => {
    it('lists charges with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/charges?limit=5',
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json<{
        data: unknown[]
        has_more: boolean
        next_cursor: string | null
      }>()

      expect(Array.isArray(body.data)).toBe(true)
      expect(typeof body.has_more).toBe('boolean')
      expect(
        body.next_cursor === null || typeof body.next_cursor === 'string',
      ).toBe(true)
    })
  })
})
