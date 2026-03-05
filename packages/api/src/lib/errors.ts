import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

interface ErrorDetail {
  field?: string
  message: string
}

export class FioError extends Error {
  readonly type: string
  readonly code: string
  readonly statusCode: number
  readonly details: ErrorDetail[]

  constructor(params: {
    type: string
    message: string
    code: string
    statusCode: number
    details?: ErrorDetail[]
  }) {
    super(params.message)
    this.name = 'FioError'
    this.type = params.type
    this.code = params.code
    this.statusCode = params.statusCode
    this.details = params.details ?? []
  }
}

export class ValidationError extends FioError {
  constructor(message: string, details?: ErrorDetail[]) {
    super({
      type: 'validation_error',
      message,
      code: 'validation_error',
      statusCode: 422,
      details,
    })
    this.name = 'ValidationError'
  }
}

export class AuthError extends FioError {
  constructor(message: string) {
    super({
      type: 'authentication_error',
      message,
      code: 'authentication_error',
      statusCode: 401,
    })
    this.name = 'AuthError'
  }
}

export class NotFoundError extends FioError {
  constructor(message: string) {
    super({
      type: 'not_found',
      message,
      code: 'not_found',
      statusCode: 404,
    })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends FioError {
  constructor(message: string) {
    super({
      type: 'conflict',
      message,
      code: 'conflict',
      statusCode: 409,
    })
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends FioError {
  constructor(message: string = 'Rate limit exceeded. Retry after the period indicated in Retry-After header.') {
    super({
      type: 'rate_limit_error',
      message,
      code: 'rate_limit_exceeded',
      statusCode: 429,
    })
    this.name = 'RateLimitError'
  }
}

export class StateTransitionError extends FioError {
  constructor(message: string) {
    super({
      type: 'validation_error',
      message,
      code: 'invalid_state_transition',
      statusCode: 422,
    })
    this.name = 'StateTransitionError'
  }
}

function formatErrorResponse(error: FioError): {
  type: string
  message: string
  code: string
  details: ErrorDetail[]
} {
  return {
    type: error.type,
    message: error.message,
    code: error.code,
    details: error.details,
  }
}

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(
    async (error: Error & { statusCode?: number; validation?: unknown[] }, _request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof FioError) {
        return reply.status(error.statusCode).send(formatErrorResponse(error))
      }

      // Handle Fastify/Zod schema validation errors (status 400)
      if (error.statusCode === 400 && error.validation) {
        return reply.status(422).send({
          type: 'validation_error',
          message: error.message,
          code: 'validation_error',
          details: [],
        })
      }

      fastify.log.error(error, 'Unhandled error')

      return reply.status(500).send({
        type: 'internal_error',
        message: 'An unexpected error occurred',
        code: 'internal_error',
        details: [],
      })
    },
  )
}

export const fioErrorHandler = fp(errorHandlerPlugin, {
  name: 'fio-error-handler',
})
