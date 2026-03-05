/**
 * Quickstart End-to-End Validation (T109)
 *
 * Follows the quickstart.mdx flow step-by-step using API calls
 * to validate the full billing lifecycle works end-to-end:
 *
 * 1. Create a customer
 * 2. Create a charge (PIX)
 * 3. Simulate payment (sandbox)
 * 4. Verify charge is paid
 * 5. Create a webhook endpoint
 * 6. Create a plan
 * 7. Create a subscription (with trial)
 * 8. Verify subscription is trialing
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  cleanupDatabase,
} from '../helpers/setup.js'

describe('Quickstart E2E — full billing lifecycle', () => {
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

  it('completes the full quickstart flow', async () => {
    // ---------------------------------------------------------------
    // Step 1: Create a customer
    // ---------------------------------------------------------------
    const customerRes = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'João Silva',
        email: 'joao@example.com',
        tax_id: '52998224725',
        tax_id_type: 'cpf',
      },
    })

    expect(customerRes.statusCode).toBe(201)
    const customer = customerRes.json<{ id: string; name: string; email: string }>()
    expect(customer.id).toBeDefined()
    expect(customer.name).toBe('João Silva')
    expect(customer.email).toBe('joao@example.com')

    // ---------------------------------------------------------------
    // Step 2: Create a PIX charge
    // ---------------------------------------------------------------
    const chargeRes = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        customer_id: customer.id,
        amount: 4990, // R$ 49.90 in centavos
        expires_in: 3600,
      },
    })

    expect(chargeRes.statusCode).toBe(201)
    const charge = chargeRes.json<{
      id: string
      status: string
      amount: number
      pix_qr_code: string | null
      pix_qr_code_image: string | null
    }>()
    expect(charge.id).toBeDefined()
    expect(charge.status).toBe('pending')
    expect(charge.amount).toBe(4990)

    // ---------------------------------------------------------------
    // Step 3: Simulate payment (sandbox)
    // ---------------------------------------------------------------
    const payRes = await app.inject({
      method: 'POST',
      url: `/v1/test/charges/${charge.id}/pay`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(payRes.statusCode).toBe(200)
    const paidCharge = payRes.json<{
      id: string
      status: string
      pix_end_to_end_id: string | null
      paid_at: string | null
    }>()
    expect(paidCharge.status).toBe('paid')
    expect(paidCharge.pix_end_to_end_id).not.toBeNull()
    expect(paidCharge.paid_at).not.toBeNull()

    // ---------------------------------------------------------------
    // Step 4: Verify charge is paid via GET
    // ---------------------------------------------------------------
    const getChargeRes = await app.inject({
      method: 'GET',
      url: `/v1/charges/${charge.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(getChargeRes.statusCode).toBe(200)
    const updatedCharge = getChargeRes.json<{ status: string }>()
    expect(updatedCharge.status).toBe('paid')

    // ---------------------------------------------------------------
    // Step 5: Create a webhook endpoint
    // ---------------------------------------------------------------
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        url: 'https://seuapp.com/webhooks/fio',
        event_types: ['charge.paid', 'subscription.canceled'],
      },
    })

    expect(webhookRes.statusCode).toBe(201)
    const endpoint = webhookRes.json<{
      id: string
      url: string
      secret: string
    }>()
    expect(endpoint.id).toBeDefined()
    expect(endpoint.url).toBe('https://seuapp.com/webhooks/fio')
    expect(endpoint.secret).toBeDefined()

    // ---------------------------------------------------------------
    // Step 6: Create a plan
    // ---------------------------------------------------------------
    const planRes = await app.inject({
      method: 'POST',
      url: '/v1/plans',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Pro Mensal',
        amount: 4990,
        interval: 'month',
        trial_days: 14,
      },
    })

    expect(planRes.statusCode).toBe(201)
    const plan = planRes.json<{
      id: string
      name: string
      amount: number
      interval: string
      trial_days: number
    }>()
    expect(plan.id).toBeDefined()
    expect(plan.name).toBe('Pro Mensal')
    expect(plan.amount).toBe(4990)
    expect(plan.trial_days).toBe(14)

    // ---------------------------------------------------------------
    // Step 7: Create a subscription (with trial)
    // ---------------------------------------------------------------
    const subRes = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        customer_id: customer.id,
        plan_id: plan.id,
      },
    })

    expect(subRes.statusCode).toBe(201)
    const subscription = subRes.json<{
      id: string
      status: string
      trial_end: string | null
      plan: { id: string; name: string }
    }>()
    expect(subscription.status).toBe('trialing')
    expect(subscription.trial_end).not.toBeNull()

    // ---------------------------------------------------------------
    // Step 8: Verify subscription via GET
    // ---------------------------------------------------------------
    const getSubRes = await app.inject({
      method: 'GET',
      url: `/v1/subscriptions/${subscription.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(getSubRes.statusCode).toBe(200)
    const fetchedSub = getSubRes.json<{
      id: string
      status: string
      plan: { id: string; name: string; amount: number }
    }>()
    expect(fetchedSub.id).toBe(subscription.id)
    expect(fetchedSub.status).toBe('trialing')
    expect(fetchedSub.plan.id).toBe(plan.id)
    expect(fetchedSub.plan.amount).toBe(4990)
  })
})
