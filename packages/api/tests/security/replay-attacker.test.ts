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
 * Persona: Replay Attacker
 *
 * Motivation: Capture and replay legitimate requests to trigger duplicate actions
 * (double charges, duplicate subscriptions, etc.).
 *
 * Defense: Idempotency keys (24h TTL), webhook timestamp validation, event ID deduplication
 */

describe('Persona: Replay Attacker — Idempotency Bypass', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let accountId: string
  let customerId: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
    const { rawKey } = await createTestApiKey(db, accountId)
    apiKey = rawKey

    // Create a customer for charge tests (idempotency is on charges)
    const customer = await createTestCustomer(db, accountId, 'test')
    customerId = customer.id
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('blocks duplicate requests with same idempotency key', async () => {
    const idempotencyKey = 'test-replay-001'

    // First request — create a charge
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 4990,
        expires_in: 3600,
      },
    })

    expect(res1.statusCode).toBe(201)
    const firstResponse = JSON.parse(res1.body)

    // Replay attempt with same idempotency key but different payload
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 100, // Different amount
        expires_in: 7200,
      },
    })

    // Should return cached response from first request
    expect(res2.statusCode).toBe(201)
    const secondResponse = JSON.parse(res2.body)

    // Responses should be identical (cached)
    expect(secondResponse.id).toBe(firstResponse.id)
    expect(secondResponse.amount).toBe(4990) // Original amount, not 100
  })

  it('returns cached response on immediate replay', async () => {
    const idempotencyKey = 'test-replay-immediate-001'

    // Create charge
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 2000,
        expires_in: 3600,
      },
    })

    expect(res1.statusCode).toBe(201)
    const firstCharge = JSON.parse(res1.body)

    // Immediate replay — should return cached response
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 9999, // Different amount
        expires_in: 7200,
      },
    })

    expect(res2.statusCode).toBe(201)
    const secondCharge = JSON.parse(res2.body)

    // Should return the original charge, not a new one
    expect(secondCharge.id).toBe(firstCharge.id)
    expect(secondCharge.amount).toBe(2000) // Original amount
  })

  it('isolates idempotency keys by account', async () => {
    const idempotencyKey = 'test-cross-account-replay-001'

    // Create second account with a customer
    const account2 = await createTestAccount(db)
    const { rawKey: apiKey2 } = await createTestApiKey(db, account2.id)
    const customer2 = await createTestCustomer(db, account2.id, 'test')

    // Account 1 creates charge with idempotency key
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 5000,
        expires_in: 3600,
      },
    })

    expect(res1.statusCode).toBe(201)
    const response1 = JSON.parse(res1.body)

    // Account 2 uses same idempotency key — should create new resource
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey2}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customer2.id,
        amount: 5000,
        expires_in: 3600,
      },
    })

    expect(res2.statusCode).toBe(201)
    const response2 = JSON.parse(res2.body)

    // Should be different charges (different accounts)
    expect(response2.id).not.toBe(response1.id)
  })

  it('only applies idempotency to POST and PUT methods', async () => {
    const idempotencyKey = 'test-get-method-001'

    // GET request with idempotency key should ignore it
    const res = await app.inject({
      method: 'GET',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
    })

    expect(res.statusCode).toBe(200)

    // Idempotency key should NOT be stored for GET
    const storedKey = await db
      .selectFrom('idempotency_keys')
      .selectAll()
      .where('key', '=', idempotencyKey)
      .where('account_id', '=', accountId)
      .executeTakeFirst()

    expect(storedKey).toBeUndefined()
  })

  it('returns same status code on replay of failed request', async () => {
    const idempotencyKey = 'test-status-code-001'
    const fakeCustomerId = '00000000-0000-0000-0000-000000000000'

    // First request that fails — non-existent customer
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: fakeCustomerId,
        amount: 1000,
        expires_in: 3600,
      },
    })

    // Should fail (404 for missing customer or 422 for validation)
    const failStatus = res1.statusCode
    expect(failStatus).toBeGreaterThanOrEqual(400)

    // Replay should return same cached error status
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId, // Valid customer this time
        amount: 1000,
        expires_in: 3600,
      },
    })

    expect(res2.statusCode).toBe(failStatus)
  })

  it('requires authentication for idempotency key usage', async () => {
    const idempotencyKey = 'test-unauthed-idempotency-001'

    // Request without auth but with idempotency key
    const res = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload: {
        customer_id: customerId,
        amount: 1000,
        expires_in: 3600,
      },
    })

    // Should fail authentication before checking idempotency
    expect(res.statusCode).toBe(401)
  })
})

describe('Persona: Replay Attacker — Timestamp Manipulation', () => {
  it('is covered by webhook-forger tests', () => {
    // Timestamp replay attacks are tested in webhook-forger.test.ts:
    // - Expired timestamp rejection
    // - Future timestamp rejection
    // - Tolerance window validation
    expect(true).toBe(true)
  })
})

describe('Persona: Replay Attacker — Concurrent Request Race', () => {
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

  it('handles concurrent requests with same idempotency key', async () => {
    const idempotencyKey = 'test-concurrent-001'

    // Send 5 concurrent charge requests with same idempotency key
    const promises = Array.from({ length: 5 }, () =>
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
          expires_in: 3600,
        },
      })
    )

    const responses = await Promise.all(promises)

    // At least one should succeed with 201
    const successful = responses.filter(r => r.statusCode === 201)
    expect(successful.length).toBeGreaterThanOrEqual(1)

    // All successful responses should return the same charge ID (deduplicated)
    if (successful.length > 1) {
      const chargeIds = successful.map(res => JSON.parse(res.body).id)
      const uniqueIds = new Set(chargeIds)
      expect(uniqueIds.size).toBe(1)
    }

    // Only one charge should be created in the database
    const charges = await db
      .selectFrom('charges')
      .selectAll()
      .where('idempotency_key', '=', idempotencyKey)
      .execute()

    expect(charges.length).toBe(1)
  })
})
