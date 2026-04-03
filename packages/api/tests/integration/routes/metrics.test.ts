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

describe('Metrics — /v1/metrics', () => {
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

    const customer = await createTestCustomer(db, account.id, 'test')

    // Create a plan and an active subscription so MRR > 0
    const suffix = Date.now()
    const plan = await db
      .insertInto('plans')
      .values({
        account_id: account.id, environment: 'test', name: `Metrics Plan ${suffix}`,
        amount: 4990, interval: 'month', trial_days: 0,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await app.inject({
      method: 'POST', url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customer.id, plan_id: plan.id },
    })
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  describe('GET /v1/metrics', () => {
    it('returns metrics with default period', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/metrics',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        mrr: number
        active_subscriptions: number
        churn_rate: number
        churn_period_days: number
      }>()

      expect(typeof body.mrr).toBe('number')
      expect(body.mrr).toBeGreaterThan(0)
      expect(typeof body.active_subscriptions).toBe('number')
      expect(body.active_subscriptions).toBeGreaterThanOrEqual(1)
      expect(typeof body.churn_rate).toBe('number')
      expect(body.churn_rate).toBeGreaterThanOrEqual(0)
      expect(body.churn_period_days).toBe(30)
    })

    it('accepts custom period_days', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/metrics?period_days=7',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{ churn_period_days: number }>()
      expect(body.churn_period_days).toBe(7)
    })

    it('requires authentication (401 without key)', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/metrics',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
