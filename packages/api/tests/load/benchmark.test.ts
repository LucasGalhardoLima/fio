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

describe('Load & Benchmarks', { timeout: 120_000 }, () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let apiKey: string
  let customerId: string
  let baseUrl: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey
    const customer = await createTestCustomer(db, account.id, 'test')
    customerId = customer.id

    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    baseUrl = address
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('GET /v1/customers — p97.5 < 500ms at 10 connections for 5s', async () => {
    const result = await autocannon({
      url: `${baseUrl}/v1/customers`,
      connections: 10,
      duration: 5,
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    })

    expect(result.latency.p97_5).toBeLessThan(500)
    expect(result.errors).toBe(0)
  })

  it('POST /v1/charges — p97.5 < 500ms at 10 connections for 5s', async () => {
    const result = await autocannon({
      url: `${baseUrl}/v1/charges`,
      connections: 10,
      duration: 5,
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        amount: 5000,
      }),
    })

    expect(result.latency.p97_5).toBeLessThan(500)
    expect(result.errors).toBe(0)
  })

  it('GET /health — p97.5 < 100ms', async () => {
    const result = await autocannon({
      url: `${baseUrl}/health`,
      connections: 10,
      duration: 5,
    })

    expect(result.latency.p97_5).toBeLessThan(100)
    expect(result.errors).toBe(0)
  })
})
