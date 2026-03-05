import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import { getMetrics } from '../../services/metrics-service.js'

const metricsQuerySchema = z.object({
  period_days: z.coerce.number().int().min(1).max(365).default(30),
})

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET /v1/metrics
   *
   * Returns dashboard metrics:
   * - mrr: Monthly Recurring Revenue in centavos
   * - active_subscriptions: count of active subscriptions
   * - churn_rate: decimal (0..1) of churn in the period
   * - churn_period_days: the period used for churn calculation
   */
  fastify.route({
    method: 'GET',
    url: '/v1/metrics',
    schema: {
      querystring: metricsQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as { period_days?: number }

      const metrics = await getMetrics(
        db,
        request.accountId,
        request.environment,
        query.period_days,
      )

      return reply.send(metrics)
    },
  })
}
