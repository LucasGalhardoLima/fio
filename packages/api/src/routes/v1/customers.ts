import type { FastifyInstance } from 'fastify'
import { createCustomerSchema, updateCustomerSchema, paginationSchema, idParamSchema } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import {
  createCustomer,
  getCustomer,
  updateCustomerService,
  deleteCustomerService,
  listCustomers,
} from '../../services/customer-service.js'

export async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  // POST /v1/customers
  fastify.route({
    method: 'POST',
    url: '/v1/customers',
    schema: {
      body: createCustomerSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const body = request.body as {
        name: string
        email: string
        tax_id: string
        tax_id_type: 'cpf' | 'cnpj'
        metadata?: Record<string, unknown>
      }

      const customer = await createCustomer(db, {
        account_id: request.accountId,
        environment: request.environment,
        name: body.name,
        email: body.email,
        tax_id: body.tax_id,
        tax_id_type: body.tax_id_type,
        metadata: body.metadata,
      })

      return reply.status(201).send(customer)
    },
  })

  // GET /v1/customers/:id
  fastify.route({
    method: 'GET',
    url: '/v1/customers/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      const customer = await getCustomer(db, params.id, request.accountId, request.environment)

      return reply.send(customer)
    },
  })

  // PUT /v1/customers/:id
  fastify.route({
    method: 'PUT',
    url: '/v1/customers/:id',
    schema: {
      params: idParamSchema,
      body: updateCustomerSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }
      const body = request.body as {
        name?: string
        email?: string
        metadata?: Record<string, unknown>
        tax_id?: string
      }

      const customer = await updateCustomerService(
        db, params.id, request.accountId, request.environment, body,
      )

      return reply.send(customer)
    },
  })

  // DELETE /v1/customers/:id
  fastify.route({
    method: 'DELETE',
    url: '/v1/customers/:id',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const params = request.params as { id: string }

      await deleteCustomerService(db, params.id, request.accountId, request.environment)

      return reply.status(204).send()
    },
  })

  // GET /v1/customers
  fastify.route({
    method: 'GET',
    url: '/v1/customers',
    schema: {
      querystring: paginationSchema,
    },
    handler: async (request, reply) => {
      const db = getDatabase()
      const query = request.query as { limit?: number; starting_after?: string }

      const result = await listCustomers(
        db, request.accountId, request.environment, query,
      )

      return reply.send(result)
    },
  })
}
