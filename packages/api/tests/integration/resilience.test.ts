import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  createTestCustomer,
  cleanupDatabase,
} from '../helpers/setup.js'

describe('Resilience', () => {
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

  describe('Concurrent Idempotent Requests', () => {
    it('produces single charge when same idempotency key is sent concurrently', async () => {
      const idempotencyKey = `concurrent-${Date.now()}`

      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'POST',
          url: '/v1/charges',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'idempotency-key': idempotencyKey,
          },
          payload: {
            customer_id: customerId,
            amount: 7500,
          },
        }),
      )

      const responses = await Promise.all(requests)

      for (const res of responses) {
        expect(res.statusCode).toBe(201)
      }

      const ids = responses.map((r) => r.json<{ id: string }>().id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(1)
    })
  })

  describe('Error Response Format Consistency', () => {
    it('404 errors have consistent format', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const res = await app.inject({
        method: 'GET',
        url: `/v1/charges/${fakeId}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(res.statusCode).toBe(404)
      const body = res.json<{ type: string; message: string }>()
      expect(body.type).toBeDefined()
      expect(body.message).toBeDefined()
    })

    it('422 validation errors have consistent format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          customer_id: customerId,
          amount: 0,
        },
      })

      expect(res.statusCode).toBe(422)
      const body = res.json<{ type: string }>()
      expect(body.type).toBe('validation_error')
    })

    it('401 auth errors have consistent format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/charges',
      })

      expect(res.statusCode).toBe(401)
      const body = res.json<{ type: string; message: string }>()
      expect(body.type).toBeDefined()
      expect(body.message).toBeDefined()
    })
  })

  describe('Large Volume Data Integrity', () => {
    it('handles 50 sequential charges without data corruption', async () => {
      const chargeIds: string[] = []

      for (let i = 0; i < 50; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/v1/charges',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: {
            customer_id: customerId,
            amount: 1000 + i,
          },
        })
        expect(res.statusCode).toBe(201)
        chargeIds.push(res.json<{ id: string }>().id)
      }

      const uniqueIds = new Set(chargeIds)
      expect(uniqueIds.size).toBe(50)

      for (let i = 0; i < 50; i++) {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/charges/${chargeIds[i]}`,
          headers: { authorization: `Bearer ${apiKey}` },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json<{ amount: number }>().amount).toBe(1000 + i)
      }
    })

    it('handles 20 parallel charge creations', async () => {
      const requests = Array.from({ length: 20 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/v1/charges',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: {
            customer_id: customerId,
            amount: 2000 + i,
          },
        }),
      )

      const responses = await Promise.all(requests)
      const ids = responses.map((r) => {
        expect(r.statusCode).toBe(201)
        return r.json<{ id: string }>().id
      })

      expect(new Set(ids).size).toBe(20)
    })
  })
})
