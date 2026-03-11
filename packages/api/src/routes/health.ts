import type { FastifyInstance } from 'fastify'
import { sql } from 'kysely'
import { getDatabase } from '../db/connection.js'

interface HealthCheck {
  status: 'ok' | 'degraded'
  checks: {
    database: 'ok' | 'error'
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

      const statusCode = result.status === 'ok' ? 200 : 503
      return reply.status(statusCode).send(result)
    },
  })
}
