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

describe('Invoices — /v1/invoices', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let accountId: string
  let customerId: string
  let planNoTrial: PlanRow

  // Store subscription + invoice IDs created during setup for filter/get tests
  let subscriptionId1: string
  let subscriptionId2: string
  let invoiceId1: string

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
        account_id: accountId, environment: 'test', name: `Invoice Plan ${suffix}`,
        amount: 1990, interval: 'month', trial_days: 0,
        dunning_schedule: JSON.stringify([1, 3, 7]) as unknown as number[],
        metadata: JSON.stringify({}) as unknown as Record<string, unknown>,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // Create two subscriptions (no trial) to generate invoices
    const sub1Res = await app.inject({
      method: 'POST', url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customerId, plan_id: planNoTrial.id },
    })
    subscriptionId1 = sub1Res.json<{ id: string }>().id

    const sub2Res = await app.inject({
      method: 'POST', url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customerId, plan_id: planNoTrial.id },
    })
    subscriptionId2 = sub2Res.json<{ id: string }>().id

    // Fetch invoices for sub1 to grab an invoice ID
    const invRes = await app.inject({
      method: 'GET', url: `/v1/invoices?subscription_id=${subscriptionId1}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })
    const invBody = invRes.json<{ data: Array<{ id: string }> }>()
    invoiceId1 = invBody.data[0]!.id
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  describe('GET /v1/invoices', () => {
    it('lists invoices with pagination', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/invoices?limit=1',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        data: unknown[]
        has_more: boolean
        next_cursor: string | null
      }>()

      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBe(1)
      // We created 2 subscriptions with invoices, so there should be more
      expect(body.has_more).toBe(true)
      expect(typeof body.next_cursor).toBe('string')
    })

    it('filters by subscription_id', async () => {
      const res = await app.inject({
        method: 'GET', url: `/v1/invoices?subscription_id=${subscriptionId1}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        data: Array<{ subscription_id: string }>
      }>()

      expect(body.data.length).toBeGreaterThanOrEqual(1)
      for (const inv of body.data) {
        expect(inv.subscription_id).toBe(subscriptionId1)
      }

      // Verify other subscription's invoices are not returned
      const res2 = await app.inject({
        method: 'GET', url: `/v1/invoices?subscription_id=${subscriptionId2}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      const body2 = res2.json<{ data: Array<{ subscription_id: string }> }>()
      for (const inv of body2.data) {
        expect(inv.subscription_id).toBe(subscriptionId2)
      }
    })

    it('filters by status', async () => {
      const res = await app.inject({
        method: 'GET', url: '/v1/invoices?status=open',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        data: Array<{ status: string }>
      }>()

      expect(body.data.length).toBeGreaterThanOrEqual(1)
      for (const inv of body.data) {
        expect(inv.status).toBe('open')
      }
    })
  })

  describe('GET /v1/invoices/:id', () => {
    it('returns an invoice by ID', async () => {
      const res = await app.inject({
        method: 'GET', url: `/v1/invoices/${invoiceId1}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        id: string
        subscription_id: string
        amount: number
        status: string
      }>()

      expect(body.id).toBe(invoiceId1)
      expect(body.subscription_id).toBe(subscriptionId1)
      expect(body.amount).toBe(planNoTrial.amount)
      expect(body.status).toBe('open')
    })

    it('returns 404 for a non-existent invoice', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const res = await app.inject({
        method: 'GET', url: `/v1/invoices/${fakeId}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
