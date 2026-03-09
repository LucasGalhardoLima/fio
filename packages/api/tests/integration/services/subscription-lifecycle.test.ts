import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

describe('Subscription Lifecycle — pause, resume, periods', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let accountId: string
  let customerId: string
  let monthlyPlan: PlanRow
  let weeklyPlan: PlanRow
  let yearlyPlan: PlanRow

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

    monthlyPlan = await db
      .insertInto('plans')
      .values({
        account_id: accountId, environment: 'test',
        name: `Monthly ${suffix}`, amount: 2990, interval: 'month',
        trial_days: 0,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    weeklyPlan = await db
      .insertInto('plans')
      .values({
        account_id: accountId, environment: 'test',
        name: `Weekly ${suffix}`, amount: 990, interval: 'week',
        trial_days: 0,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    yearlyPlan = await db
      .insertInto('plans')
      .values({
        account_id: accountId, environment: 'test',
        name: `Yearly ${suffix}`, amount: 29900, interval: 'year',
        trial_days: 0,
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

  async function createActiveSub(planId: string) {
    const res = await app.inject({
      method: 'POST', url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customerId, plan_id: planId },
    })
    expect(res.statusCode).toBe(201)
    return res.json<{ id: string; status: string }>()
  }

  describe('POST /v1/subscriptions/:id/pause', () => {
    it('pauses an active subscription', async () => {
      const sub = await createActiveSub(monthlyPlan.id)
      expect(sub.status).toBe('active')

      const res = await app.inject({
        method: 'POST',
        url: `/v1/subscriptions/${sub.id}/pause`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; paused_at: string | null }>()
      expect(body.status).toBe('paused')
      expect(body.paused_at).not.toBeNull()
    })

    it('rejects pause on non-active subscription (trialing)', async () => {
      const trialPlan = await db
        .insertInto('plans')
        .values({
          account_id: accountId, environment: 'test',
          name: `Trial ${Date.now()}`, amount: 1990, interval: 'month',
          trial_days: 14,
          dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
          metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const createRes = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: trialPlan.id },
      })
      const sub = createRes.json<{ id: string; status: string }>()
      expect(sub.status).toBe('trialing')

      const res = await app.inject({
        method: 'POST',
        url: `/v1/subscriptions/${sub.id}/pause`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(res.statusCode).toBe(422)
    })
  })

  describe('POST /v1/subscriptions/:id/resume', () => {
    it('resumes a paused subscription and recalculates period', async () => {
      const sub = await createActiveSub(monthlyPlan.id)

      await app.inject({
        method: 'POST',
        url: `/v1/subscriptions/${sub.id}/pause`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/v1/subscriptions/${sub.id}/resume`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json<{
        status: string
        paused_at: string | null
        current_period_end: string
      }>()
      expect(body.status).toBe('active')
      expect(body.paused_at).toBeNull()
      const periodEnd = new Date(body.current_period_end)
      const now = new Date()
      const diffDays = (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(27)
      expect(diffDays).toBeLessThan(32)
    })

    it('rejects resume on non-paused subscription', async () => {
      const sub = await createActiveSub(monthlyPlan.id)

      const res = await app.inject({
        method: 'POST',
        url: `/v1/subscriptions/${sub.id}/resume`,
        headers: { authorization: `Bearer ${apiKey}` },
      })

      expect(res.statusCode).toBe(422)
    })
  })

  describe('Billing period calculation by interval', () => {
    it('weekly plan: period_end is ~7 days from start', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: weeklyPlan.id },
      })
      const body = res.json<{
        current_period_start: string
        current_period_end: string
      }>()
      const start = new Date(body.current_period_start)
      const end = new Date(body.current_period_end)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeCloseTo(7, 0)
    })

    it('monthly plan: period_end is ~30 days from start', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: monthlyPlan.id },
      })
      const body = res.json<{
        current_period_start: string
        current_period_end: string
      }>()
      const start = new Date(body.current_period_start)
      const end = new Date(body.current_period_end)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(27)
      expect(diffDays).toBeLessThan(32)
    })

    it('yearly plan: period_end is ~365 days from start', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { customer_id: customerId, plan_id: yearlyPlan.id },
      })
      const body = res.json<{
        current_period_start: string
        current_period_end: string
      }>()
      const start = new Date(body.current_period_start)
      const end = new Date(body.current_period_end)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(364)
      expect(diffDays).toBeLessThan(367)
    })
  })
})
