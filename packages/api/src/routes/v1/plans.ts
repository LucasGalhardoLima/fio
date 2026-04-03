import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createPlanSchema, paginationSchema, idParamSchema } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import {
  createPlan,
  getPlan,
  archivePlan,
  listPlans,
} from '../../services/plan-service.js'

const planListQuerySchema = paginationSchema.extend({
  active: z.coerce.boolean().optional(),
})

export async function planRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // POST /v1/plans
  fastify.route({
    method: 'POST',
    url: '/v1/plans',
    schema: {
      body: createPlanSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const body = request.body as {
        name: string
        amount: number
        interval: string
        trial_days?: number
        dunning_schedule?: number[]
        metadata?: Record<string, unknown>
      }

      const plan = await createPlan(db, {
        account_id: request.accountId,
        environment: request.environment,
        name: body.name,
        amount: body.amount,
        interval: body.interval,
        trial_days: body.trial_days,
        dunning_schedule: body.dunning_schedule,
        metadata: body.metadata,
      })

      return reply.status(201).send(plan)
    },
  })

  // GET /v1/plans/:id
  fastify.route({
    method: 'GET',
    url: '/v1/plans/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const plan = await getPlan(db, params.id, request.accountId, request.environment)

      return reply.send(plan)
    },
  })

  // DELETE /v1/plans/:id (archive)
  fastify.route({
    method: 'DELETE',
    url: '/v1/plans/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const plan = await archivePlan(
        db, params.id, request.accountId, request.environment,
      )

      return reply.send(plan)
    },
  })

  // GET /v1/plans
  fastify.route({
    method: 'GET',
    url: '/v1/plans',
    schema: {
      querystring: planListQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
        active?: boolean
      }

      const result = await listPlans(
        db,
        request.accountId,
        request.environment,
        { limit: query.limit, starting_after: query.starting_after },
        { active: query.active },
      )

      return reply.send(result)
    },
  })
}
