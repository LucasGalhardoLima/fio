import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import {
  createTestApp,
  createTestDatabase,
  cleanupDatabase,
} from '../../helpers/setup.js'

describe('Health — /health', () => {
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

  describe('GET /health', () => {
    it('returns health status with database check', async () => {
      const res = await app.inject({
        method: 'GET', url: '/health',
      })

      // Database is available so expect 200
      expect(res.statusCode).toBe(200)

      const body = res.json<{
        status: 'ok' | 'degraded'
        checks: {
          database: 'ok' | 'error'
          redis: 'ok' | 'error'
        }
      }>()

      expect(body.checks.database).toBe('ok')
      // Redis may or may not be available in test; just check the shape
      expect(['ok', 'error']).toContain(body.checks.redis)

      // Overall status depends on both checks
      if (body.checks.database === 'ok' && body.checks.redis === 'ok') {
        expect(body.status).toBe('ok')
      } else {
        expect(body.status).toBe('degraded')
      }
    })

    it('does not require authentication', async () => {
      // No authorization header — should still respond
      const res = await app.inject({
        method: 'GET', url: '/health',
      })

      // Should get a response (200 or 503), not 401
      expect([200, 503]).toContain(res.statusCode)
    })
  })
})
