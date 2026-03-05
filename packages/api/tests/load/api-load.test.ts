/**
 * API Load Tests (T113)
 *
 * Production target: 100 req/s sustained, <200ms p95 latency (co-located DB).
 *
 * CI baseline: 50 req/s, <500ms p95 (accounts for remote DB latency).
 * When running against a co-located PostgreSQL, bump thresholds to
 * production targets.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import autocannon from 'autocannon'
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

// CI-safe thresholds (remote DB adds ~100ms roundtrip per query)
const MIN_RPS = 50
const MAX_P95_MS = 500

describe('Load tests', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let customerId: string
  let serverUrl: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey

    const customer = await createTestCustomer(db, account.id, 'test')
    customerId = customer.id

    // Start listening on a random port for autocannon
    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    serverUrl = address
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it(`customer listing: sustains ${MIN_RPS} req/s with <${MAX_P95_MS}ms p95`, async () => {
    const result = await autocannon({
      url: `${serverUrl}/v1/customers?limit=10`,
      connections: 10,
      duration: 5,
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    })

    console.log('Customer listing results:')
    console.log(`  Requests/sec: ${result.requests.average}`)
    console.log(`  Latency p50: ${result.latency.p50}ms`)
    console.log(`  Latency p97.5: ${result.latency.p97_5}ms`)
    console.log(`  Latency p99: ${result.latency.p99}ms`)
    console.log(`  Errors: ${result.errors}`)
    console.log(`  Timeouts: ${result.timeouts}`)

    expect(result.errors).toBe(0)
    expect(result.timeouts).toBe(0)
    expect(result.requests.average).toBeGreaterThanOrEqual(MIN_RPS)
    expect(result.latency.p97_5).toBeLessThanOrEqual(MAX_P95_MS)
  }, 30_000)

  it(`charge creation: sustains ${MIN_RPS} req/s with <${MAX_P95_MS}ms p95`, async () => {
    const result = await autocannon({
      url: `${serverUrl}/v1/charges`,
      method: 'POST',
      connections: 10,
      duration: 5,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        amount: 1000,
        expires_in: 3600,
      }),
    })

    console.log('Charge creation results:')
    console.log(`  Requests/sec: ${result.requests.average}`)
    console.log(`  Latency p50: ${result.latency.p50}ms`)
    console.log(`  Latency p97.5: ${result.latency.p97_5}ms`)
    console.log(`  Latency p99: ${result.latency.p99}ms`)
    console.log(`  Errors: ${result.errors}`)
    console.log(`  Timeouts: ${result.timeouts}`)

    expect(result.errors).toBe(0)
    expect(result.timeouts).toBe(0)
    expect(result.requests.average).toBeGreaterThanOrEqual(MIN_RPS)
    expect(result.latency.p97_5).toBeLessThanOrEqual(MAX_P95_MS)
  }, 30_000)
})
