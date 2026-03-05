import type { FastifyRequest, FastifyReply } from 'fastify'
import argon2 from 'argon2'
import { getDatabase } from '../db/connection.js'
import { AuthError } from '../lib/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    accountId: string
    environment: string
  }
}

const KEY_PREFIX_LENGTH = 12

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (!header) {
    throw new AuthError('Missing Authorization header. Expected: Bearer fio_<env>_<key>')
  }

  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new AuthError('Invalid Authorization header format. Expected: Bearer fio_<env>_<key>')
  }

  return parts[1]
}

function deriveEnvironment(key: string): 'test' | 'live' {
  if (key.startsWith('fio_test_')) {
    return 'test'
  }
  if (key.startsWith('fio_live_')) {
    return 'live'
  }
  throw new AuthError('Invalid API key format. Key must start with fio_test_ or fio_live_')
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request)
  const environment = deriveEnvironment(token)
  const keyPrefix = token.slice(0, KEY_PREFIX_LENGTH)

  const db = getDatabase()

  const apiKey = await db
    .selectFrom('api_keys')
    .selectAll()
    .where('key_prefix', '=', keyPrefix)
    .executeTakeFirst()

  if (!apiKey) {
    throw new AuthError('Invalid API key')
  }

  const isValid = await argon2.verify(apiKey.key_hash, token)
  if (!isValid) {
    throw new AuthError('Invalid API key')
  }

  if (apiKey.revoked_at !== null) {
    throw new AuthError('API key has been revoked')
  }

  if (apiKey.expires_at !== null && apiKey.expires_at < new Date()) {
    throw new AuthError('API key has expired')
  }

  request.accountId = apiKey.account_id
  request.environment = environment
}
