import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { FioClient } from '../src/client.js'
import { Fio, FioAuthError, FioNotFoundError, FioValidationError, FioRateLimitError, FioConflictError } from '../src/index.js'

describe('FioClient', () => {
  it('should detect test environment from key prefix', () => {
    const client = new FioClient({ apiKey: 'fio_test_abc123' })
    expect(client.environment).toBe('test')
  })

  it('should detect live environment from key prefix', () => {
    const client = new FioClient({ apiKey: 'fio_live_abc123' })
    expect(client.environment).toBe('live')
  })

  it('should use default base URL', () => {
    const client = new FioClient({ apiKey: 'fio_test_abc123' })
    expect(client.baseUrl).toBe('https://api.fio.com.br/v1')
  })

  it('should accept custom base URL', () => {
    const client = new FioClient({
      apiKey: 'fio_test_abc123',
      baseUrl: 'http://localhost:3000/v1',
    })
    expect(client.baseUrl).toBe('http://localhost:3000/v1')
  })
})

describe('Fio', () => {
  it('should expose all resource classes', () => {
    const fio = new Fio({ apiKey: 'fio_test_abc123' })
    expect(fio.customers).toBeDefined()
    expect(fio.plans).toBeDefined()
    expect(fio.subscriptions).toBeDefined()
    expect(fio.charges).toBeDefined()
    expect(fio.invoices).toBeDefined()
    expect(fio.webhookEndpoints).toBeDefined()
  })

  it('should expose test resource for test keys', () => {
    const fio = new Fio({ apiKey: 'fio_test_abc123' })
    expect(fio.test).toBeDefined()
  })

  it('should not expose test resource for live keys', () => {
    const fio = new Fio({ apiKey: 'fio_live_abc123' })
    expect(fio.test).toBeNull()
  })
})

describe('Fio.webhooks.verify', () => {
  const secret = 'whsec_test_secret_123'
  const payload = JSON.stringify({
    id: 'evt_abc123',
    type: 'charge.paid',
    created_at: '2026-03-04T10:00:00Z',
    data: { id: 'chg_def456', status: 'paid' },
  })

  function createSignature(body: string, timestamp: number, signingSecret: string): string {
    const signature = createHmac('sha256', signingSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  it('should verify valid webhook signature', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createSignature(payload, timestamp, secret)
    const event = Fio.webhooks.verify(payload, signature, secret)
    expect(event.type).toBe('charge.paid')
    expect(event.id).toBe('evt_abc123')
  })

  it('should reject expired timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 600
    const signature = createSignature(payload, timestamp, secret)
    expect(() => Fio.webhooks.verify(payload, signature, secret)).toThrow('timestamp too old')
  })

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = `t=${timestamp},v1=invalidsignatureinvalidsignatureinvalidsignatureinvalidsignature12345678`
    expect(() => Fio.webhooks.verify(payload, signature, secret)).toThrow('Invalid webhook signature')
  })

  it('should reject malformed header', () => {
    expect(() => Fio.webhooks.verify(payload, 'invalid', secret)).toThrow('Invalid Fio-Signature')
  })
})

describe('Error classes', () => {
  const errorResponse = {
    type: 'validation_error',
    message: 'Invalid input',
    code: 'invalid_input',
    details: [{ field: 'email', message: 'required', code: 'required' }],
  }

  it('should create FioValidationError with correct status', () => {
    const error = new FioValidationError(errorResponse)
    expect(error.statusCode).toBe(422)
    expect(error.type).toBe('validation_error')
    expect(error.message).toBe('Invalid input')
    expect(error.details).toHaveLength(1)
  })

  it('should create FioAuthError', () => {
    const error = new FioAuthError({ ...errorResponse, type: 'authentication_error' })
    expect(error.statusCode).toBe(401)
  })

  it('should create FioNotFoundError', () => {
    const error = new FioNotFoundError({ ...errorResponse, type: 'not_found_error' })
    expect(error.statusCode).toBe(404)
  })

  it('should create FioRateLimitError', () => {
    const error = new FioRateLimitError({ ...errorResponse, type: 'rate_limit_error' })
    expect(error.statusCode).toBe(429)
  })

  it('should create FioConflictError', () => {
    const error = new FioConflictError({ ...errorResponse, type: 'conflict_error' })
    expect(error.statusCode).toBe(409)
  })
})
