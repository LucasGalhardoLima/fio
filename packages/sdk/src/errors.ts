import type { ErrorResponse } from '@fio-pay/shared'

export class FioError extends Error {
  readonly type: string
  readonly code: string
  readonly statusCode: number
  readonly details: Array<{ field: string; message: string; code: string }>

  constructor(response: ErrorResponse, statusCode: number) {
    super(response.message)
    this.name = 'FioError'
    this.type = response.type
    this.code = response.code
    this.statusCode = statusCode
    this.details = response.details ?? []
  }
}

export class FioValidationError extends FioError {
  constructor(response: ErrorResponse) {
    super(response, 422)
    this.name = 'FioValidationError'
  }
}

export class FioAuthError extends FioError {
  constructor(response: ErrorResponse) {
    super(response, 401)
    this.name = 'FioAuthError'
  }
}

export class FioNotFoundError extends FioError {
  constructor(response: ErrorResponse) {
    super(response, 404)
    this.name = 'FioNotFoundError'
  }
}

export class FioRateLimitError extends FioError {
  constructor(response: ErrorResponse) {
    super(response, 429)
    this.name = 'FioRateLimitError'
  }
}

export class FioConflictError extends FioError {
  constructor(response: ErrorResponse) {
    super(response, 409)
    this.name = 'FioConflictError'
  }
}
