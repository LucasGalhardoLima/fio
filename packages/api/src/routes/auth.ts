import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { getDatabase } from '../db/connection.js'
import {
  registerAccount,
  loginAccount,
} from '../services/account-service.js'

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.route({
    method: 'POST',
    url: '/auth/register',
    schema: { body: registerSchema },
    handler: async (request, reply) => {
      const db = getDatabase()
      const result = await registerAccount(db, request.body)

      return reply.status(201).send({
        account: {
          id: result.account.id,
          name: result.account.name,
          email: result.account.email,
          created_at: result.account.created_at.toISOString(),
        },
        api_keys: {
          test: result.testKey,
          live: result.liveKey,
        },
      })
    },
  })

  app.route({
    method: 'POST',
    url: '/auth/login',
    schema: { body: loginSchema },
    handler: async (request, reply) => {
      const db = getDatabase()
      const result = await loginAccount(db, request.body)

      return reply.send({
        account: {
          id: result.account.id,
          name: result.account.name,
          email: result.account.email,
        },
        session_token: result.sessionToken,
      })
    },
  })
}
