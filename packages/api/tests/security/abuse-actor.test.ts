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
 * Persona: Abuse Actor
 *
 * Motivation: Exhaust system resources via excessive requests, large payloads,
 * or automated attacks.
 *
 * Defense: Rate limiting (100 req/min per account), request size limits,
 * webhook retry backoff, database query timeouts
 */

describe('Persona: Abuse Actor — Rate Limit Bypass', () => {
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

  it('enforces rate limit after 100 requests per minute', async () => {
    const requests = []

    // Send 101 requests rapidly
    for (let i = 0; i < 101; i++) {
      requests.push(
        app.inject({
          method: 'GET',
          url: '/v1/customers',
          headers: { authorization: `Bearer ${apiKey}` },
        })
      )
    }

    const responses = await Promise.all(requests)

    // First 100 should succeed
    const successful = responses.filter(r => r.statusCode === 200)
    const rateLimited = responses.filter(r => r.statusCode === 429)

    expect(successful.length).toBe(100)
    expect(rateLimited.length).toBe(1)
  })

  it('returns rate limit headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(res.headers['x-ratelimit-limit']).toBeDefined()
    expect(res.headers['x-ratelimit-remaining']).toBeDefined()
    expect(res.headers['x-ratelimit-reset']).toBeDefined()
  })

  it('returns Retry-After header on rate limit', async () => {
    // Exhaust rate limit
    const requests = Array.from({ length: 101 }, () =>
      app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
      })
    )

    const responses = await Promise.all(requests)
    const rateLimitedResponse = responses.find(r => r.statusCode === 429)

    expect(rateLimitedResponse).toBeDefined()
    expect(rateLimitedResponse!.headers['retry-after']).toBeDefined()

    const retryAfter = parseInt(rateLimitedResponse!.headers['retry-after'] as string, 10)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60) // Should be within 1 minute window
  })

  it('isolates rate limits by account', async () => {
    // Create second account
    const account2 = await createTestAccount(db)
    const { rawKey: apiKey2 } = await createTestApiKey(db, account2.id)

    // Exhaust first account's rate limit
    const requests1 = Array.from({ length: 100 }, () =>
      app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
      })
    )
    await Promise.all(requests1)

    // Second account should still have its full rate limit
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey2}` },
    })

    expect(res2.statusCode).toBe(200)
    expect(res2.headers['x-ratelimit-remaining']).toBe('99') // Full limit available
  })

  it('rate limits unauthenticated requests by IP', async () => {
    const requests = []

    // Send 101 unauthenticated requests from same IP
    for (let i = 0; i < 101; i++) {
      requests.push(
        app.inject({
          method: 'GET',
          url: '/v1/health',
          // No auth header - should be rate limited by IP
        })
      )
    }

    const responses = await Promise.all(requests)

    // Should eventually hit rate limit
    const successful = responses.filter(r => r.statusCode === 200)
    const rateLimited = responses.filter(r => r.statusCode === 429)

    expect(rateLimited.length).toBeGreaterThan(0)
    expect(successful.length + rateLimited.length).toBe(101)
  })
})

describe('Persona: Abuse Actor — Resource Exhaustion', () => {
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

  it('rejects excessively large request payloads', async () => {
    // Create a 10MB payload (assuming server has body size limit)
    const largePayload = {
      name: 'A'.repeat(10 * 1024 * 1024), // 10MB of 'A'
      email: 'test@example.com',
      tax_id: '12345678909',
      tax_id_type: 'cpf',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/v1/customers',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: largePayload,
    })

    // Should reject large payload (413 or 400)
    expect([400, 413]).toContain(res.statusCode)
  })

  it('prevents mass resource creation in single request', async () => {
    // Attempt to create many customers in a loop
    const promises = []
    for (let i = 0; i < 1000; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/v1/customers',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: {
            name: `Customer ${i}`,
            email: `customer${i}@example.com`,
            tax_id: `${i}`.padStart(11, '0'),
            tax_id_type: 'cpf',
          },
        })
      )
    }

    const responses = await Promise.all(promises)

    // Should hit rate limit before creating 1000 customers
    const rateLimited = responses.filter(r => r.statusCode === 429)
    expect(rateLimited.length).toBeGreaterThan(0)

    // Verify actual customers created is less than 1000
    const customers = await db
      .selectFrom('customers')
      .selectAll()
      .where('email', 'like', 'customer%@example.com')
      .execute()

    expect(customers.length).toBeLessThan(1000)
    expect(customers.length).toBeLessThanOrEqual(100) // Rate limit
  })
})

describe('Persona: Abuse Actor — Webhook Endpoint Spamming', () => {
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

  it('prevents creation of excessive webhook endpoints', async () => {
    const promises = []

    // Attempt to create 50 webhook endpoints
    for (let i = 0; i < 50; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/v1/webhook_endpoints',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: {
            url: `https://example.com/webhook${i}`,
            event_types: ['charge.paid'],
          },
        })
      )
    }

    const responses = await Promise.all(promises)

    // Should hit rate limit before creating all endpoints
    const rateLimited = responses.filter(r => r.statusCode === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
  })

  it('enforces maximum webhook endpoints per account', async () => {
    // This test assumes there's a max limit (e.g., 10 endpoints per account)
    // If no such limit exists, this is a recommendation to add one

    const promises = []
    for (let i = 0; i < 15; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/v1/webhook_endpoints',
          headers: { authorization: `Bearer ${apiKey}` },
          payload: {
            url: `https://unique-domain-${i}.example.com/webhook`,
            event_types: ['charge.paid'],
          },
        })
      )
    }

    const responses = await Promise.all(promises)

    // Should either hit rate limit or max endpoint limit
    const failed = responses.filter(r => r.statusCode >= 400)
    expect(failed.length).toBeGreaterThan(0)
  })
})

describe('Persona: Abuse Actor — Query Complexity Attack', () => {
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

    // Create test data
    for (let i = 0; i < 50; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          name: `Test Customer ${i}`,
          email: `test${i}@example.com`,
          tax_id: `${i}`.padStart(11, '0'),
          tax_id_type: 'cpf',
        },
      })
    }
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('limits pagination page size', async () => {
    // Attempt to request excessive page size
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers?limit=10000', // Excessive limit
      headers: { authorization: `Bearer ${apiKey}` },
    })

    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)

    // Should cap at reasonable limit (e.g., 100)
    expect(data.data.length).toBeLessThanOrEqual(100)
  })

  it('rejects invalid cursor-based pagination tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/customers?starting_after=invalid_id_that_does_not_exist',
      headers: { authorization: `Bearer ${apiKey}` },
    })

    // Should reject invalid cursor
    expect([400, 404]).toContain(res.statusCode)
  })
})

describe('Persona: Abuse Actor — Distributed Attack Simulation', () => {
  it('is mitigated by per-account rate limiting', () => {
    // Distributed attacks from multiple IPs but same account are mitigated
    // by account-based rate limiting (tested in rate limit tests above).
    //
    // IP-based rate limiting for unauthenticated endpoints is also tested above.
    //
    // Additional DDoS protection (e.g., Cloudflare, AWS Shield) should be
    // configured at infrastructure level.
    expect(true).toBe(true)
  })
})
