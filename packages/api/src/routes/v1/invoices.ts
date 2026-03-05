import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { paginationSchema, idParamSchema, statusValues } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import { getInvoice } from '../../services/invoice-service.js'
import { listInvoicesWithCursor } from '../../db/queries/invoices.js'
import { paginateResults, normalizePaginationLimit } from '../../lib/pagination.js'

const invoiceListQuerySchema = paginationSchema.extend({
  subscription_id: z.string().uuid().optional(),
  status: statusValues.invoice.optional(),
})

export async function invoiceRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // GET /v1/invoices/:id
  fastify.route({
    method: 'GET',
    url: '/v1/invoices/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const invoice = await getInvoice(
        db, params.id, request.accountId, request.environment,
      )

      return reply.send(invoice)
    },
  })

  // GET /v1/invoices
  fastify.route({
    method: 'GET',
    url: '/v1/invoices',
    schema: {
      querystring: invoiceListQuerySchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as {
        limit?: number
        starting_after?: string
        subscription_id?: string
        status?: string
      }

      const limit = normalizePaginationLimit(query.limit)

      const rows = await listInvoicesWithCursor(
        db,
        request.accountId,
        request.environment,
        limit + 1,
        query.starting_after,
        {
          subscription_id: query.subscription_id,
          status: query.status,
        },
      )

      const result = paginateResults(rows, limit)

      return reply.send(result)
    },
  })
}
