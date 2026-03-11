import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { RateLimitError } from '../lib/errors.js'

async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    nameSpace: 'fio-rate-limit:',
    keyGenerator: (request) => {
      const accountId: string | undefined = request.accountId
      if (accountId !== undefined) {
        return accountId
      }
      return request.ip
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    errorResponseBuilder: () => {
      throw new RateLimitError()
    },
  })
}

export const fioRateLimit = fp(rateLimitPlugin, {
  name: 'fio-rate-limit',
})
