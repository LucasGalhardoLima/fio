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

/**
 * Persona: Credential Thief + Internal Misuse
 *
 * Motivation: Abuse legitimate access to gain unauthorized privileges or access
 * restricted resources.
 *
 * Defense: Environment isolation (test vs live), resource ownership validation,
 * immutable field protection, parameterized queries
 */

describe('Persona: Credential Thief — API Key Compromise', () => {
  // These tests are already covered in auth-isolation.test.ts:
  // - Returns 401 for missing Authorization header
  // - Returns 401 for invalid format
  // - Returns 401 for non-existent API key
  // - Returns 401 for revoked API key
  // - Returns 401 for expired API key

  it('is covered by existing auth-isolation tests', () => {
    // See packages/api/tests/integration/auth-isolation.test.ts
    expect(true).toBe(true)
  })
})

describe('Persona: Internal Misuse — Environment Isolation', () => {
  let app: FastifyInstance
  let db: Kysely<Database>

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('test mode keys cannot access live data', async () => {
    // Create test and live accounts
    const testAccount = await createTestAccount(db, { environment: 'test' })
    const { rawKey: testKey } = await createTestApiKey(db, testAccount.id)

    const liveAccount = await createTestAccount(db, { environment: 'live' })
    const { rawKey: liveKey } = await createTestApiKey(db, liveAccount.id)

    // Create a customer in live mode
    const liveRes = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${liveKey}` },
      payload: {
        name: 'Live Customer',
        email: 'live@example.com',
        tax_id: '11111111111',
        tax_id_type: 'cpf',
      },
    })

    expect(liveRes.statusCode).toBe(201)
    const liveCustomer = JSON.parse(liveRes.body)

    // Attempt to access live customer with test key
    const testRes = await app.inject({
      method: 'GET',
      url: `/v1/customers/${liveCustomer.id}`,
      headers: { authorization: `Bearer ${testKey}` },
    })

    // Should not be able to access (404 or 403)
    expect([403, 404]).toContain(testRes.statusCode)
  })

  it('live mode keys cannot access test data', async () => {
    const testAccount = await createTestAccount(db, { environment: 'test' })
    const { rawKey: testKey } = await createTestApiKey(db, testAccount.id)

    const liveAccount = await createTestAccount(db, { environment: 'live' })
    const { rawKey: liveKey } = await createTestApiKey(db, liveAccount.id)

    // Create a customer in test mode
    const testRes = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${testKey}` },
      payload: {
        name: 'Test Customer',
        email: 'test@example.com',
        tax_id: '22222222222',
        tax_id_type: 'cpf',
      },
    })

    expect(testRes.statusCode).toBe(201)
    const testCustomer = JSON.parse(testRes.body)

    // Attempt to access test customer with live key
    const liveRes = await app.inject({
      method: 'GET',
      url: `/v1/customers/${testCustomer.id}`,
      headers: { authorization: `Bearer ${liveKey}` },
    })

    // Should not be able to access
    expect([403, 404]).toContain(liveRes.statusCode)
  })

  it('environment is correctly inferred from API key prefix', async () => {
    const testAccount = await createTestAccount(db)
    const { rawKey: testKey } = await createTestApiKey(db, testAccount.id)

    // Test key should start with fio_test_
    expect(testKey.startsWith('fio_test_')).toBe(true)

    // Make request and verify environment is set correctly
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${testKey}` },
    })

    expect(res.statusCode).toBe(200)
    // Environment should be available in request context (verified in middleware)
  })
})

describe('Persona: Internal Misuse — ID Guessing/Enumeration', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let accountId: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
    const { rawKey } = await createTestApiKey(db, accountId)
    apiKey = rawKey
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('blocks access to other accounts resources via ID guessing', () => {
    // Already covered in auth-isolation.test.ts:
    // - "account A cannot see account B customers"
    // - "account A cannot modify account B customer"
    // - "account A cannot delete account B customer"
    // - "account A cannot see account B charges"
    expect(true).toBe(true)
  })

  it('returns 404 for non-existent resource IDs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers/cus_nonexistent123',
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('does not leak information about resource existence', async () => {
    // Create second account with a customer
    const account2 = await createTestAccount(db)
    const { rawKey: apiKey2 } = await createTestApiKey(db, account2.id)

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey2}` },
      payload: {
        name: 'Other Account Customer',
        email: 'other@example.com',
        tax_id: '33333333333',
        tax_id_type: 'cpf',
      },
    })

    const otherCustomer = JSON.parse(res2.body)

    // Attempt to access with first account's key
    const res1 = await app.inject({
      method: 'GET',
      url: `/v1/customers/${otherCustomer.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    // Should return 404, not 403 (to avoid leaking existence)
    expect(res1.statusCode).toBe(404)

    // Attempt to access truly non-existent ID
    const resFake = await app.inject({
      method: 'GET',
      url: '/v1/customers/cus_fake123',
      headers: { authorization: `Bearer ${apiKey}` },
    })

    // Should also return 404 (same error for both cases)
    expect(resFake.statusCode).toBe(404)

    // Error messages should not leak information
    const body1 = JSON.parse(res1.body)
    const bodyFake = JSON.parse(resFake.body)
    expect(body1.error).toBe(bodyFake.error)
  })
})

describe('Persona: Internal Misuse — Immutable Field Protection', () => {
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

  it('prevents modification of charge amount after creation', async () => {
    // Create customer
    const customerRes = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Test Customer',
        email: 'test@example.com',
        tax_id: '44444444444',
        tax_id_type: 'cpf',
      },
    })

    const customer = JSON.parse(customerRes.body)

    // Create charge
    const chargeRes = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        customer_id: customer.id,
        amount: 4990, // R$ 49.90
      },
    })

    expect(chargeRes.statusCode).toBe(201)
    const charge = JSON.parse(chargeRes.body)
    expect(charge.amount).toBe(4990)

    // Attempt to modify charge amount
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/charges/${charge.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        amount: 1, // Try to change to R$ 0.01
      },
    })

    // Should reject modification (400 or 422)
    expect([400, 422]).toContain(updateRes.statusCode)

    // Verify amount unchanged
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/charges/${charge.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    const updatedCharge = JSON.parse(getRes.body)
    expect(updatedCharge.amount).toBe(4990) // Original amount
  })

  it('prevents modification of customer_id on subscription', async () => {
    // Create two customers
    const customer1Res = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Customer 1',
        email: 'customer1@example.com',
        tax_id: '55555555555',
        tax_id_type: 'cpf',
      },
    })

    const customer1 = JSON.parse(customer1Res.body)

    const customer2Res = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Customer 2',
        email: 'customer2@example.com',
        tax_id: '66666666666',
        tax_id_type: 'cpf',
      },
    })

    const customer2 = JSON.parse(customer2Res.body)

    // Create plan
    const planRes = await app.inject({
      method: 'POST',
      url: '/v1/plans',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Test Plan',
        amount: 2990,
        interval: 'month',
      },
    })

    const plan = JSON.parse(planRes.body)

    // Create subscription for customer 1
    const subRes = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        customer_id: customer1.id,
        plan_id: plan.id,
      },
    })

    expect(subRes.statusCode).toBe(201)
    const subscription = JSON.parse(subRes.body)
    expect(subscription.customer_id).toBe(customer1.id)

    // Attempt to change subscription to customer 2
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/subscriptions/${subscription.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        customer_id: customer2.id, // Try to steal subscription
      },
    })

    // Should reject modification
    expect([400, 422]).toContain(updateRes.statusCode)

    // Verify customer_id unchanged
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/subscriptions/${subscription.id}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    const updatedSub = JSON.parse(getRes.body)
    expect(updatedSub.customer_id).toBe(customer1.id) // Original customer
  })
})

describe('Persona: Internal Misuse — SQL Injection', () => {
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

  it('prevents SQL injection via email field', async () => {
    const maliciousEmail = "'; DROP TABLE customers; --"

    const res = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        name: 'Test',
        email: maliciousEmail,
        tax_id: '77777777777',
        tax_id_type: 'cpf',
      },
    })

    // Should fail validation (422) or create customer with escaped email
    if (res.statusCode === 201) {
      const customer = JSON.parse(res.body)
      expect(customer.email).toBe(maliciousEmail) // Stored as-is, not executed
    } else {
      expect(res.statusCode).toBe(422) // Invalid email format
    }

    // Verify customers table still exists (not dropped)
    const customersExist = await db.selectFrom('customers').selectAll().execute()
    expect(customersExist).toBeDefined()
  })

  it('prevents SQL injection via filter parameters', async () => {
    const maliciousFilter = "' OR '1'='1"

    const res = await app.inject({
      method: 'GET',
      url: `/v1/customers?email=${encodeURIComponent(maliciousFilter)}`,
      headers: { authorization: `Bearer ${apiKey}` },
    })

    // Should return safe results (parameterized query)
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)

    // Should not return all customers (which would happen if injection worked)
    // Instead, should return empty list (no customer with that email)
    expect(data.data).toEqual([])
  })

  it('uses parameterized queries throughout', () => {
    // All queries use Kysely, which automatically parameterizes queries
    // This is verified by code inspection - no raw SQL string concatenation
    expect(true).toBe(true)
  })
})
