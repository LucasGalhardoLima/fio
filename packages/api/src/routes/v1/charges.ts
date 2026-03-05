import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createChargeSchema, paginationSchema, idParamSchema, statusValues } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.js'
import {
  createCharge,
  getCharge,
  listCharges,
  refundCharge,
} from '../../services/charge-service.js'
import type { PaymentProvider } from '../../providers/payment-provider.js'

const chargeListQuerySchema = paginationSchema.extend({
  status: statusValues.charge.optional(),
  customer_id: z.string().uuid().optional(),
})

interface ChargeRoutesOptions {
  provider: PaymentProvider
  pixKey: string
}

export async function chargeRoutes(
  fastify: FastifyInstance,
  opts: ChargeRoutesOptions,
): Promise<void> {
  const { provider, pixKey } = opts

  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // POST /v1/charges
  fastify.route({
    method: 'POST',
    url: '/v1/charges',
    schema: {
      body: createChargeSchema,
    },
    preHandler: [idempotencyMiddleware],
    handler: async (request, reply) => {
      const db = getDatabase()
      const body = request.body as {
        customer_id: string
        amount: number
        expires_in: number
        description?: string
        metadata?: Record<string, unknown>
      }

      const idempotencyKey = typeof request.headers['idempotency-key'] === 'string'
        ? request.headers['idempotency-key']
        : undefined

      const charge = await createCharge(db, provider, {
        account_id: request.accountId,
        environment: request.environment,
        customer_id: body.customer_id,
        amount: body.amount,
        expires_in: body.expires_in,
        pix_key: pixKey,
        idempotency_key: idempotencyKey,
        metadata: body.metadata,
      })

      return reply.status(201).send(charge)
    },
  })

  // GET /v1/charges/:id
  fastify.route({
    method: 'GET',
    url: '/v1/charges/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const charge = await getCharge(db, params.id, request.accountId, request.environment)

      return reply.send(charge)
    },
  })

  // POST /v1/charges/:id/refund
  fastify.route({
    method: 'POST',
    url: '/v1/charges/:id/refund',
    schema: {
      params: idParamSchema,
      body: z.object({ amount: z.number().int().positive().optional() }).optional(),
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }
      const body = (request.body as { amount?: number } | undefined) ?? {}

      const charge = await refundCharge(
        db,
        provider,
        params.id,
        request.accountId,
        request.environment,
        body.amount,
      )

      return reply.send(charge)
    },
  })

  // GET /v1/charges
  fastify.route({
    method: 'GET',
    url: '/v1/charges',
    schema: {
      querystring: chargeListQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
        status?: string
        customer_id?: string
      }

      const result = await listCharges(
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
