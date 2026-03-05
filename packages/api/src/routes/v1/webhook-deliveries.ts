import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { paginationSchema } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import { listWebhookDeliveriesWithCursor } from '../../db/queries/webhook-deliveries.js'
import { paginateResults, normalizePaginationLimit } from '../../lib/pagination.js'

const deliveryListQuerySchema = paginationSchema.extend({
  webhook_endpoint_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'delivered', 'failed']).optional(),
})

export async function webhookDeliveryRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // GET /v1/webhook-deliveries — list deliveries with filters
  fastify.route({
    method: 'GET',
    url: '/v1/webhook-deliveries',
    schema: {
      querystring: deliveryListQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
        webhook_endpoint_id?: string
        event_id?: string
        status?: string
      }

      const limit = normalizePaginationLimit(query.limit)

      const rows = await listWebhookDeliveriesWithCursor(
        db,
        limit + 1,
        query.starting_after,
        {
          webhook_endpoint_id: query.webhook_endpoint_id,
          event_id: query.event_id,
          status: query.status,
        },
      )

      const result = paginateResults(rows, limit)

      return reply.send(result)
    },
  })
}
