import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import {
  listApiKeys,
  generateApiKeyForAccount,
  revokeApiKey,
} from '../../services/account-service.js'

const generateSchema = z.object({
  environment: z.enum(['test', 'live']),
  name: z.string().max(255).optional(),
})

export async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.addHook('onRequest', authMiddleware)

  app.route({
    method: 'GET',
    url: '/v1/api-keys',
    handler: async (request) => {
      const db = getDatabase()
      const keys = await listApiKeys(db, request.accountId)
      return { data: keys }
    },
  })

  app.route({
    method: 'POST',
    url: '/v1/api-keys',
    schema: { body: generateSchema },
    handler: async (request, reply) => {
      const db = getDatabase()
      const { environment, name } = request.body
      const { apiKey, rawKey } = await generateApiKeyForAccount(
        db,
        request.accountId,
        environment,
        name,
      )
      return reply.status(201).send({
        id: apiKey.id,
        key_prefix: apiKey.key_prefix,
        environment: apiKey.environment,
        name: apiKey.name,
        created_at: apiKey.created_at.toISOString(),
        raw_key: rawKey,
      })
    },
  })

  app.route({
    method: 'POST',
    url: '/v1/api-keys/:id/revoke',
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const { id } = request.params as { id: string }
      await revokeApiKey(db, id, request.accountId)
      return reply.status(204).send()
    },
  })
}
