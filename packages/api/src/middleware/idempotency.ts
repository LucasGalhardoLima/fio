import type { FastifyRequest, FastifyReply } from 'fastify'
import { getDatabase } from '../db/connection.js'
import { ValidationError } from '../lib/errors.js'

const IDEMPOTENCY_TTL_HOURS = 24

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toResponseBody(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value
  }
  return { value }
}

export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const method = request.method
  if (method !== 'POST' && method !== 'PUT') {
    return
  }

  const idempotencyKey = request.headers['idempotency-key']
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
    return
  }

  const accountId: string | undefined = request.accountId
  if (accountId === undefined) {
    throw new ValidationError('Idempotency-Key requires an authenticated request')
  }

  const db = getDatabase()

  const existing = await db
    .selectFrom('idempotency_keys')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('key', '=', idempotencyKey)
    .where('expires_at', '>', new Date())
    .executeTakeFirst()

  if (existing) {
    const body = existing.response_body
    await reply.status(existing.response_status).send(body)
    return
  }

  const originalSend = reply.send.bind(reply)

  const interceptedSend: typeof reply.send = function wrappedSend(payload: unknown) {
    const statusCode = reply.statusCode

    void storeIdempotencyResponse(
      db,
      accountId,
      idempotencyKey,
      method,
      request.url,
      statusCode,
      payload,
    )

    return originalSend(payload)
  }

  reply.send = interceptedSend
}

async function storeIdempotencyResponse(
  db: ReturnType<typeof getDatabase>,
  accountId: string,
  key: string,
  method: string,
  path: string,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS)

  try {
    await db
      .insertInto('idempotency_keys')
      .values({
        account_id: accountId,
        key,
        method,
        path,
        response_status: responseStatus,
        response_body: toResponseBody(responseBody),
        expires_at: expiresAt,
      })
      .onConflict((oc) =>
        oc.columns(['account_id', 'key']).doNothing(),
      )
      .execute()
  } catch (err: unknown) {
    // Log but do not fail the request if idempotency storage fails
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error(`Failed to store idempotency key: ${message}`)
  }
}
