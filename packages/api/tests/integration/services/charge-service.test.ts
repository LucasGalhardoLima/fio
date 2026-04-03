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

describe('Charge Service — refunds & lifecycle', () => {
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

  async function createAndPayCharge(amount: number) {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customerId, amount },
    })
    const charge = createRes.json<{ id: string }>()

    const payRes = await app.inject({
      method: 'POST',
      url: `/v1/test/charges/${charge.id}/pay`,
      headers: { authorization: `Bearer ${apiKey}` },
    })
    expect(payRes.statusCode).toBe(200)

    return charge.id
  }

  describe('POST /v1/charges/:id/refund', () => {
    it('processes full refund when amount is omitted', async () => {
      const chargeId = await createAndPayCharge(5000)
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; refunded_amount: number }>()
      expect(body.status).toBe('refunded')
      expect(body.refunded_amount).toBe(5000)
    })

    it('processes partial refund', async () => {
      const chargeId = await createAndPayCharge(10000)
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 3000 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; refunded_amount: number }>()
      expect(body.status).toBe('partially_refunded')
      expect(body.refunded_amount).toBe(3000)
    })

    it('allows second partial refund after first', async () => {
      const chargeId = await createAndPayCharge(10000)
      await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 3000 },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 4000 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; refunded_amount: number }>()
      expect(body.status).toBe('partially_refunded')
      expect(body.refunded_amount).toBe(7000)
    })

    it('transitions to refunded when partial refunds sum to full amount', async () => {
      const chargeId = await createAndPayCharge(6000)
      await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 2000 },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 4000 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; refunded_amount: number }>()
      expect(body.status).toBe('refunded')
      expect(body.refunded_amount).toBe(6000)
    })

    it('rejects refund exceeding remaining amount', async () => {
      const chargeId = await createAndPayCharge(5000)
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 5001 },
      })
      expect(res.statusCode).toBe(422)
    })

    it('rejects refund on pending (unpaid) charge', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, amount: 5000 },
      })
      const { id } = createRes.json<{ id: string }>()
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${id}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {},
      })
      expect(res.statusCode).toBe(422)
    })

    it('handles large refund amounts correctly', async () => {
      const chargeId = await createAndPayCharge(9_999_999)
      const res = await app.inject({
        method: 'POST',
        url: `/v1/charges/${chargeId}/refund`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { amount: 9_999_999 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; refunded_amount: number }>()
      expect(body.status).toBe('refunded')
      expect(body.refunded_amount).toBe(9_999_999)
    })
  })
})
