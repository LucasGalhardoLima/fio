import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  paginationSchema,
  idParamSchema,
  statusValues,
} from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import type { PaymentProvider } from '../../providers/payment-provider.js'
import {
  createSubscription,
  getSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  listSubscriptions,
} from '../../services/subscription-service.js'

const subscriptionListQuerySchema = paginationSchema.extend({
  status: statusValues.subscription.optional(),
  customer_id: z.string().uuid().optional(),
})

interface SubscriptionRoutesOptions {
  provider: PaymentProvider
}

export async function subscriptionRoutes(
  fastify: FastifyInstance,
  opts: SubscriptionRoutesOptions,
): Promise<void> {
  const { provider } = opts

  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // POST /v1/subscriptions
  fastify.route({
    method: 'POST',
    url: '/v1/subscriptions',
    schema: {
      body: createSubscriptionSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const body = request.body as {
        customer_id: string
        plan_id: string
        pix_automatico?: boolean
        cancel_at_period_end?: boolean
        metadata?: Record<string, unknown>
      }

      const subscription = await createSubscription(db, provider, {
        account_id: request.accountId,
        environment: request.environment,
        customer_id: body.customer_id,
        plan_id: body.plan_id,
        pix_automatico: body.pix_automatico,
        cancel_at_period_end: body.cancel_at_period_end,
        metadata: body.metadata,
      })

      return reply.status(201).send(subscription)
    },
  })

  // GET /v1/subscriptions/:id
  fastify.route({
    method: 'GET',
    url: '/v1/subscriptions/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const subscription = await getSubscription(
        db, params.id, request.accountId, request.environment,
      )

      return reply.send(subscription)
    },
  })

  // POST /v1/subscriptions/:id/cancel
  fastify.route({
    method: 'POST',
    url: '/v1/subscriptions/:id/cancel',
    schema: {
      params: idParamSchema,
      body: cancelSubscriptionSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }
      const body = request.body as { cancel_at_period_end?: boolean }

      const subscription = await cancelSubscription(
        db,
        params.id,
        request.accountId,
        request.environment,
        body.cancel_at_period_end ?? false,
      )

      return reply.send(subscription)
    },
  })

  // POST /v1/subscriptions/:id/pause
  fastify.route({
    method: 'POST',
    url: '/v1/subscriptions/:id/pause',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const subscription = await pauseSubscription(
        db, params.id, request.accountId, request.environment,
      )

      return reply.send(subscription)
    },
  })

  // POST /v1/subscriptions/:id/resume
  fastify.route({
    method: 'POST',
    url: '/v1/subscriptions/:id/resume',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const subscription = await resumeSubscription(
        db, params.id, request.accountId, request.environment,
      )

      return reply.send(subscription)
    },
  })

  // GET /v1/subscriptions
  fastify.route({
    method: 'GET',
    url: '/v1/subscriptions',
    schema: {
      querystring: subscriptionListQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
        status?: string
        customer_id?: string
      }

      const result = await listSubscriptions(
        db,
        request.accountId,
        request.environment,
        { limit: query.limit, starting_after: query.starting_after },
        { status: query.status, customer_id: query.customer_id },
      )

      return reply.send(result)
    },
  })
}
