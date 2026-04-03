import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'

export async function registerOpenAPI(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Fio Billing API',
        description: 'Subscription billing API for PIX payments in Brazil',
        version: '1.0.0',
      },
      servers: [
        { url: 'https://api.fio.com.br', description: 'Production' },
        { url: 'http://localhost:3000', description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'API key (fio_test_* or fio_live_*)',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })
}
