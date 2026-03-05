import type { FastifyInstance } from 'fastify'
import { sql } from 'kysely'
import { Redis as IORedis } from 'ioredis'
import { getDatabase } from '../db/connection.js'

interface HealthCheck {
  status: 'ok' | 'degraded'
  checks: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.route({
    method: 'GET',
    url: '/health',
    handler: async (_request, reply) => {
      const result: HealthCheck = {
        status: 'ok',
        checks: {
          database: 'ok',
          redis: 'ok',
        },
      }

      // Check PostgreSQL
      try {
        const db = getDatabase()
        await sql`SELECT 1`.execute(db)
      } catch {
        result.checks.database = 'error'
        result.status = 'degraded'
      }

      // Check Redis
      try {
        const redisUrl = process.env['REDIS_URL']
        if (redisUrl) {
          const redis = new IORedis(redisUrl)
          await redis.ping()
          await redis.quit()
        }
      } catch {
        result.checks.redis = 'error'
        result.status = 'degraded'
      }

      const statusCode = result.status === 'ok' ? 200 : 503
      return reply.status(statusCode).send(result)
    },
  })
}
