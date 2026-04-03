import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { maskCpf, maskCnpj, maskEmail } from '../lib/pii-mask.js'

function sanitizeString(str: string): string {
  // Mask common PII patterns in URL query params and bodies
  return str
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, (m) => maskCpf(m))
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, (m) => maskCnpj(m))
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, (m) => maskEmail(m))
}

async function loggerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.log.info({
      msg: 'incoming request',
      method: request.method,
      url: sanitizeString(request.url),
      requestId: request.id,
    })
  })

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info({
      msg: 'request completed',
      method: request.method,
      url: sanitizeString(request.url),
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
      requestId: request.id,
    })
  })
}

export const fioLogger = fp(loggerPlugin, {
  name: 'fio-logger',
  fastify: '5.x',
})
