import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'kysely'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database, PlanRow } from '../../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  createTestCustomer,
  cleanupDatabase,
} from '../../helpers/setup.js'

describe('Subscriptions — /v1/subscriptions', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let accountId: string
  let customerId: string
  let planNoTrial: PlanRow
  let planWithTrial: PlanRow

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
    const { rawKey } = await createTestApiKey(db, accountId)
    apiKey = rawKey

    const customer = await createTestCustomer(db, accountId, 'test')
    customerId = customer.id

    const suffix = Date.now()
    planNoTrial = await db
      .insertInto('plans')
      .values({
        account_id: accountId, environment: 'test', name: `Monthly Plan ${suffix}`,
        amount: 2990, interval: 'month', trial_days: 0,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    planWithTrial = await db
      .insertInto('plans')
      .values({
        account_id: accountId, environment: 'test', name: `Monthly Plan with Trial ${suffix}`,
        amount: 4990, interval: 'month', trial_days: 14,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  describe('POST /v1/subscriptions', () => {
    it('creates with trial -> status=trialing', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: planWithTrial.id },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json<{ id: string; status: string; trial_end: string | null }>()
      expect(body.id).toBeDefined()
      expect(body.status).toBe('trialing')
      expect(body.trial_end).not.toBeNull()
    })

    it('creates without trial -> status=active, charge generated', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: planNoTrial.id },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json<{ id: string; status: string; trial_end: string | null }>()
      expect(body.status).toBe('active')
      expect(body.trial_end).toBeNull()

      // Verify invoice + charge were generated
      const invRes = await app.inject({
        method: 'GET', url: `/v1/invoices?subscription_id=${body.id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(invRes.statusCode).toBe(200)
      const invBody = invRes.json<{
        data: Array<{ subscription_id: string; status: string; amount: number; charge_id: string | null }>
      }>()
      expect(invBody.data.length).toBeGreaterThanOrEqual(1)
      const inv = invBody.data[0]!
      expect(inv.subscription_id).toBe(body.id)
      expect(inv.status).toBe('open')
      expect(inv.amount).toBe(planNoTrial.amount)
      expect(inv.charge_id).not.toBeNull()
    })
  })

  describe('POST /v1/subscriptions/:id/cancel', () => {
    it('cancels immediately -> status=canceled', async () => {
      const createRes = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: planWithTrial.id },
      })
      const { id } = createRes.json<{ id: string }>()

      const cancelRes = await app.inject({
        method: 'POST', url: `/v1/subscriptions/${id}/cancel`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { cancel_at_period_end: false },
      })
      expect(cancelRes.statusCode).toBe(200)
      const body = cancelRes.json<{ status: string; canceled_at: string | null }>()
      expect(body.status).toBe('canceled')
      expect(body.canceled_at).not.toBeNull()
    })

    it('sets cancel_at_period_end=true without changing status', async () => {
      const createRes = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: planWithTrial.id },
      })
      const { id } = createRes.json<{ id: string }>()

      const cancelRes = await app.inject({
        method: 'POST', url: `/v1/subscriptions/${id}/cancel`,
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { cancel_at_period_end: true },
      })
      expect(cancelRes.statusCode).toBe(200)
      const body = cancelRes.json<{ status: string; cancel_at_period_end: boolean }>()
      expect(body.status).toBe('trialing')
      expect(body.cancel_at_period_end).toBe(true)
    })
  })

  describe('GET /v1/subscriptions/:id', () => {
    it('returns subscription with plan data', async () => {
      const createRes = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: planWithTrial.id },
      })
      const { id } = createRes.json<{ id: string }>()

      const res = await app.inject({
        method: 'GET', url: `/v1/subscriptions/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{
        id: string; plan: { id: string; name: string; amount: number; interval: string }
      }>()
      expect(body.id).toBe(id)
      expect(body.plan).toBeDefined()
      expect(body.plan.id).toBe(planWithTrial.id)
      expect(body.plan.amount).toBe(4990)
    })
  })

  describe('GET /v1/subscriptions', () => {
    it('lists with status filter', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/subscriptions?status=trialing&limit=5',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ data: Array<{ status: string }>; has_more: boolean }>()
      expect(Array.isArray(body.data)).toBe(true)
      for (const sub of body.data) {
        expect(sub.status).toBe('trialing')
      }
    })

    it('lists with pagination', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/subscriptions?limit=2',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json<{ data: unknown[]; has_more: boolean; next_cursor: string | null }>()
      expect(body.data.length).toBeLessThanOrEqual(2)
      expect(body.next_cursor === null || typeof body.next_cursor === 'string').toBe(true)
    })
  })
})
