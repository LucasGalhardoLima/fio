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

  it('blocks duplicate requests with same idempotency key', async () => {
    const idempotencyKey = 'test-replay-001'

    // First request
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Test Customer',
        email: 'test@example.com',
        tax_id: '12345678909',
        tax_id_type: 'cpf',
      },
    })

    expect(res1.statusCode).toBe(201)
    const firstResponse = JSON.parse(res1.body)

    // Replay attempt with same idempotency key
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Different Customer', // Different payload
        email: 'different@example.com',
        tax_id: '98765432100',
        tax_id_type: 'cpf',
      },
    })

    // Should return cached response from first request
    expect(res2.statusCode).toBe(201)
    const secondResponse = JSON.parse(res2.body)

    // Responses should be identical (cached)
    expect(secondResponse.id).toBe(firstResponse.id)
    expect(secondResponse.name).toBe('Test Customer') // Original name, not "Different Customer"
    expect(secondResponse.email).toBe('test@example.com')
  })

  it('allows new requests after idempotency key expires', async () => {
    const idempotencyKey = 'test-replay-expired-001'

    // Create first request
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'First Customer',
        email: 'first@example.com',
        tax_id: '11111111111',
        tax_id_type: 'cpf',
      },
    })

    expect(res1.statusCode).toBe(201)
    const firstResponse = JSON.parse(res1.body)

    // Manually expire the idempotency key
    await db
      .updateTable('idempotency_keys')
      .set({ expires_at: new Date(Date.now() - 1000) }) // 1 second ago
      .where('key', '=', idempotencyKey)
      .where('account_id', '=', accountId)
      .execute()

    // New request with expired key should create new resource
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Second Customer',
        email: 'second@example.com',
        tax_id: '22222222222',
        tax_id_type: 'cpf',
      },
    })

    expect(res2.statusCode).toBe(201)
    const secondResponse = JSON.parse(res2.body)

    // Should be a different customer
    expect(secondResponse.id).not.toBe(firstResponse.id)
    expect(secondResponse.name).toBe('Second Customer')
  })

  it('isolates idempotency keys by account', async () => {
    const idempotencyKey = 'test-cross-account-replay-001'

    // Create second account
    const account2 = await createTestAccount(db)
    const { rawKey: apiKey2 } = await createTestApiKey(db, account2.id)

    // Account 1 creates customer with idempotency key
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Account 1 Customer',
        email: 'account1@example.com',
        tax_id: '33333333333',
        tax_id_type: 'cpf',
      },
    })

    expect(res1.statusCode).toBe(201)
    const response1 = JSON.parse(res1.body)

    // Account 2 uses same idempotency key - should create new resource
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey2}`,
        'idempotency-key': idempotencyKey, // Same key
      },
      payload: {
        name: 'Account 2 Customer',
        email: 'account2@example.com',
        tax_id: '44444444444',
        tax_id_type: 'cpf',
      },
    })

    expect(res2.statusCode).toBe(201)
    const response2 = JSON.parse(res2.body)

    // Should be different customers (different accounts)
    expect(response2.id).not.toBe(response1.id)
    expect(response2.name).toBe('Account 2 Customer')
  })

  it('only applies idempotency to POST and PUT methods', async () => {
    const idempotencyKey = 'test-get-method-001'

    // GET request with idempotency key should ignore it
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers',
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

  it('returns same status code on replay', async () => {
    const idempotencyKey = 'test-status-code-001'

    // First request that fails validation
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Test',
        email: 'invalid-email', // Invalid email
        tax_id: '12345678909',
        tax_id_type: 'cpf',
      },
    })

    expect(res1.statusCode).toBe(422) // Validation error

    // Replay should return same 422 status
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Test',
        email: 'valid@example.com', // Now valid, but should return cached error
        tax_id: '12345678909',
        tax_id_type: 'cpf',
      },
    })

    expect(res2.statusCode).toBe(422)
  })

  it('requires authentication for idempotency key usage', async () => {
    const idempotencyKey = 'test-unauthed-idempotency-001'

    // Request without auth but with idempotency key
    const res = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Test Customer',
        email: 'test@example.com',
        tax_id: '12345678909',
        tax_id_type: 'cpf',
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

  it('handles concurrent requests with same idempotency key', async () => {
    const idempotencyKey = 'test-concurrent-001'

    // Send 5 concurrent requests with same idempotency key
    const promises = Array.from({ length: 5 }, () =>
      app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          name: 'Concurrent Customer',
          email: 'concurrent@example.com',
          tax_id: '55555555555',
          tax_id_type: 'cpf',
        },
      })
    )

    const responses = await Promise.all(promises)

    // All should succeed
    responses.forEach(res => {
      expect(res.statusCode).toBe(201)
    })

    // All should return the same customer ID (deduplicated)
    const customerIds = responses.map(res => JSON.parse(res.body).id)
    const uniqueIds = new Set(customerIds)
    expect(uniqueIds.size).toBe(1)

    // Only one customer should be created
    const customers = await db
      .selectFrom('customers')
      .selectAll()
      .where('email', '=', 'concurrent@example.com')
      .execute()

    expect(customers.length).toBe(1)
  })
})
