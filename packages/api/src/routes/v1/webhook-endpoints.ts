import type { FastifyInstance } from 'fastify'
import { createWebhookEndpointSchema, paginationSchema, idParamSchema } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import {
  registerEndpoint,
  listEndpoints,
  deleteEndpoint,
} from '../../services/webhook-service.js'

export async function webhookEndpointRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // POST /v1/webhook-endpoints — create a new webhook endpoint
  fastify.route({
    method: 'POST',
    url: '/v1/webhook-endpoints',
    schema: {
      body: createWebhookEndpointSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const body = request.body as {
        url: string
        event_types?: string[] | null
      }

      const endpoint = await registerEndpoint(db, {
        account_id: request.accountId,
        environment: request.environment,
        url: body.url,
        event_types: body.event_types ?? null,
      })

      // Secret is shown once on creation
      return reply.status(201).send(endpoint)
    },
  })

  // GET /v1/webhook-endpoints — list endpoints (secrets NOT shown)
  fastify.route({
    method: 'GET',
    url: '/v1/webhook-endpoints',
    schema: {
      querystring: paginationSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
      }

      const result = await listEndpoints(
        db,
        request.accountId,
        request.environment,
        { limit: query.limit, starting_after: query.starting_after },
      )

      return reply.send(result)
    },
  })

  // DELETE /v1/webhook-endpoints/:id — delete an endpoint
  fastify.route({
    method: 'DELETE',
    url: '/v1/webhook-endpoints/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      await deleteEndpoint(db, params.id, request.accountId, request.environment)

      return reply.status(204).send()
    },
  })
}
