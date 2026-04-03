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

describe('Auth & Multi-Tenant Isolation', () => {
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

  describe('Authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 when Authorization header has invalid format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: 'InvalidFormat' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 for non-existent API key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: 'Bearer fio_test_nonexistentkey1234567890abcdef' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 for revoked API key', async () => {
      const account = await createTestAccount(db)
      const { rawKey } = await createTestApiKey(db, account.id, {
        revoked_at: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${rawKey}` },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 for expired API key', async () => {
      const account = await createTestAccount(db)
      const { rawKey } = await createTestApiKey(db, account.id, {
        expires_at: new Date(Date.now() - 86_400_000),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${rawKey}` },
      })
      expect(res.statusCode).toBe(401)
    })

    it('accepts valid API key', async () => {
      const account = await createTestAccount(db)
      const { rawKey } = await createTestApiKey(db, account.id)

      const res = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${rawKey}` },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('Cross-Account Isolation', () => {
    it('account A cannot see account B customers', async () => {
      const accountA = await createTestAccount(db)
      const { rawKey: keyA } = await createTestApiKey(db, accountA.id)
      const customerA = await createTestCustomer(db, accountA.id, 'test')

      const accountB = await createTestAccount(db)
      const { rawKey: keyB } = await createTestApiKey(db, accountB.id)

      const res = await app.inject({
        method: 'GET',
        url: `/v1/customers/${customerA.id}`,
        headers: { authorization: `Bearer ${keyB}` },
      })
      expect(res.statusCode).toBe(404)

      const resA = await app.inject({
        method: 'GET',
        url: `/v1/customers/${customerA.id}`,
        headers: { authorization: `Bearer ${keyA}` },
      })
      expect(resA.statusCode).toBe(200)
    })

    it('account A cannot see account B charges', async () => {
      const accountA = await createTestAccount(db)
      const { rawKey: keyA } = await createTestApiKey(db, accountA.id)
      const customerA = await createTestCustomer(db, accountA.id, 'test')

      const chargeRes = await app.inject({
        method: 'POST',
        url: '/v1/charges',
        headers: { authorization: `Bearer ${keyA}` },
        payload: { customer_id: customerA.id, amount: 5000 },
      })
      const chargeId = chargeRes.json<{ id: string }>().id

      const accountB = await createTestAccount(db)
      const { rawKey: keyB } = await createTestApiKey(db, accountB.id)

      const res = await app.inject({
        method: 'GET',
        url: `/v1/charges/${chargeId}`,
        headers: { authorization: `Bearer ${keyB}` },
      })
      expect(res.statusCode).toBe(404)
    })

    it('listing only returns own account data', async () => {
      const accountA = await createTestAccount(db)
      const { rawKey: keyA } = await createTestApiKey(db, accountA.id)
      await createTestCustomer(db, accountA.id, 'test', {
        email: `isolated-a-${Date.now()}@test.com`,
      })

      const accountB = await createTestAccount(db)
      const { rawKey: keyB } = await createTestApiKey(db, accountB.id)
      await createTestCustomer(db, accountB.id, 'test', {
        email: `isolated-b-${Date.now()}@test.com`,
      })

      const resA = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${keyA}` },
      })
      const dataA = resA.json<{ data: Array<{ id: string }> }>()

      // Verify account B can't see any of A's customers by checking B's list
      const resB = await app.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${keyB}` },
      })
      const dataB = resB.json<{ data: Array<{ id: string }> }>()

      // No overlap between A and B customer IDs
      const idsA = new Set(dataA.data.map((c) => c.id))
      const idsB = new Set(dataB.data.map((c) => c.id))
      for (const id of idsA) {
        expect(idsB.has(id)).toBe(false)
      }
    })
  })

  describe('Test vs Live Environment Separation', () => {
    it('test key cannot see live environment data', async () => {
      const account = await createTestAccount(db)
      const { rawKey: testKey } = await createTestApiKey(db, account.id, {
        environment: 'test',
      })
      const { rawKey: liveKey } = await createTestApiKey(db, account.id, {
        environment: 'live',
      })

      const liveCustomer = await createTestCustomer(db, account.id, 'live', {
        email: `live-${Date.now()}@test.com`,
      })

      const res = await app.inject({
        method: 'GET',
        url: `/v1/customers/${liveCustomer.id}`,
        headers: { authorization: `Bearer ${testKey}` },
      })
      expect(res.statusCode).toBe(404)

      const resLive = await app.inject({
        method: 'GET',
        url: `/v1/customers/${liveCustomer.id}`,
        headers: { authorization: `Bearer ${liveKey}` },
      })
      expect(resLive.statusCode).toBe(200)
    })
  })
})
