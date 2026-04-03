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

describe('Plans — /v1/plans', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  describe('POST /v1/plans', () => {
    it('creates a plan and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: 'Pro Monthly',
          amount: 4990,
          interval: 'month',
          trial_days: 7,
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json<{
        id: string; name: string; amount: number; interval: string; trial_days: number; active: boolean
      }>()
      expect(body.id).toBeDefined()
      expect(body.name).toBe('Pro Monthly')
      expect(body.amount).toBe(4990)
      expect(body.interval).toBe('month')
      expect(body.trial_days).toBe(7)
      expect(body.active).toBe(true)
    })

    it('creates a plan with zero trial days', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'Basic Monthly', amount: 1990, interval: 'month' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json<{ trial_days: number }>().trial_days).toBe(0)
    })

    it('rejects amount below MIN_CHARGE_AMOUNT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'Too Cheap', amount: MIN_CHARGE_AMOUNT - 1, interval: 'month' },
      })
      expect(res.statusCode).toBe(422)
    })

    it('accepts amount exactly at MIN_CHARGE_AMOUNT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'Minimum Plan', amount: MIN_CHARGE_AMOUNT, interval: 'month' },
      })
      expect(res.statusCode).toBe(201)
    })

    it('supports all interval types', async () => {
      for (const interval of ['week', 'month', 'year']) {
        const res = await app.inject({
          method: 'POST',
          url: '/v1/plans',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: { name: `${interval}ly plan`, amount: 2990, interval },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json<{ interval: string }>().interval).toBe(interval)
      }
    })
  })

  describe('GET /v1/plans/:id', () => {
    it('returns plan by ID', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'Fetch Test', amount: 3990, interval: 'month' },
      })
      const { id } = createRes.json<{ id: string }>()

      const res = await app.inject({
        method: 'GET',
        url: `/v1/plans/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json<{ id: string }>().id).toBe(id)
    })

    it('returns 404 for non-existent plan', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/plans/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /v1/plans/:id (archive)', () => {
    it('archives plan and sets active=false', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { name: 'To Archive', amount: 1990, interval: 'month' },
      })
      const { id } = createRes.json<{ id: string }>()

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/plans/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json<{ active: boolean }>().active).toBe(false)
    })

    it('cannot create subscription to archived plan', async () => {
      const account = await createTestAccount(db)
      const { rawKey } = await createTestApiKey(db, account.id)
      const customer = await createTestCustomer(db, account.id, 'test')

      const planRes = await app.inject({
        method: 'POST',
        url: '/v1/plans',
        headers: { authorization: `Bearer ${rawKey}` },
        payload: { name: 'Will Archive', amount: 2990, interval: 'month' },
      })
      const planId = planRes.json<{ id: string }>().id

      await app.inject({
        method: 'DELETE',
        url: `/v1/plans/${planId}`,
        headers: { authorization: `Bearer ${rawKey}` },
      })

      const subRes = await app.inject({
        method: 'POST',
        url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${rawKey}` },
        payload: { customer_id: customer.id, plan_id: planId },
      })
      expect(subRes.statusCode).toBe(422)
    })
  })

  describe('GET /v1/plans (list)', () => {
    it('lists plans with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/plans?limit=5',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ data: unknown[]; has_more: boolean }>()
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('filters by active status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/plans?active=true',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ data: Array<{ active: boolean }> }>()
      for (const plan of body.data) {
        expect(plan.active).toBe(true)
      }
    })
  })
})
