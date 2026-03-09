import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  createTestAccount,
  createTestApiKey,
  cleanupDatabase,
} from '../../helpers/setup.js'

describe('Webhook Endpoints — /v1/webhook-endpoints', () => {
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

  describe('POST /v1/webhook-endpoints', () => {
    it('creates an endpoint and returns secret (201)', async () => {
      const res = await app.inject({
        method: 'POST', url: '/v1/webhook-endpoints',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: {
          url: 'https://example.com/webhook',
          event_types: ['charge.paid', 'subscription.canceled'],
        },
      })
      expect(res.statusCode).toBe(201)

      const body = res.json<{
        id: string
        url: string
        secret: string
        event_types: string[]
      }>()

      expect(body.id).toBeDefined()
      expect(body.url).toBe('https://example.com/webhook')
      expect(body.secret).toBeDefined()
      // 32 bytes = 64 hex chars
      expect(body.secret).toHaveLength(64)
      expect(body.event_types).toEqual(['charge.paid', 'subscription.canceled'])
    })
  })

  describe('GET /v1/webhook-endpoints', () => {
    it('lists endpoints without secrets', async () => {
      // Ensure at least one endpoint exists
      await app.inject({
        method: 'POST', url: '/v1/webhook-endpoints',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { url: 'https://example.com/hook2' },
      })

      const res = await app.inject({
        method: 'GET', url: '/v1/webhook-endpoints',
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        data: Array<{ id: string; url: string; secret?: string }>
        has_more: boolean
      }>()

      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThanOrEqual(1)

      // Secrets must NOT be present in list responses
      for (const ep of body.data) {
        expect(ep).not.toHaveProperty('secret')
        expect(ep.id).toBeDefined()
        expect(ep.url).toBeDefined()
      }
    })
  })

  describe('DELETE /v1/webhook-endpoints/:id', () => {
    it('deletes an endpoint and returns 204', async () => {
      // Create an endpoint to delete
      const createRes = await app.inject({
        method: 'POST', url: '/v1/webhook-endpoints',
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { url: 'https://example.com/to-delete' },
      })
      const { id } = createRes.json<{ id: string }>()

      const deleteRes = await app.inject({
        method: 'DELETE', url: `/v1/webhook-endpoints/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(deleteRes.statusCode).toBe(204)

      // Verify it's gone — should return 404 on a second delete
      const deleteAgainRes = await app.inject({
        method: 'DELETE', url: `/v1/webhook-endpoints/${id}`,
        headers: { authorization: `Bearer ${apiKey}` },
      })
      expect(deleteAgainRes.statusCode).toBe(404)
    })
  })
})
