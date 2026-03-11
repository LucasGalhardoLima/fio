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
const SESSION_TOKEN_PREFIX_LENGTH = 12

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (!header) {
    throw new AuthError('Missing Authorization header')
  }

  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new AuthError('Invalid Authorization header format. Expected: Bearer <token>')
  }

  return parts[1]
}

function isApiKey(token: string): boolean {
  return token.startsWith('fio_test_') || token.startsWith('fio_live_')
}

function deriveEnvironment(key: string): 'test' | 'live' {
  if (key.startsWith('fio_test_')) {
    return 'test'
  }
  return 'live'
}

async function authenticateWithApiKey(
  request: FastifyRequest,
  token: string,
): Promise<void> {
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

async function authenticateWithSessionToken(
  request: FastifyRequest,
  token: string,
): Promise<void> {
  const prefix = token.slice(0, SESSION_TOKEN_PREFIX_LENGTH)

  const db = getDatabase()

  const account = await db
    .selectFrom('accounts')
    .select(['id', 'session_token_hash', 'session_expires_at'])
    .where('session_token_prefix', '=', prefix)
    .executeTakeFirst()

  if (!account || !account.session_token_hash) {
    throw new AuthError('Invalid session token')
  }

  const isValid = await argon2.verify(account.session_token_hash, token)
  if (!isValid) {
    throw new AuthError('Invalid session token')
  }

  if (!account.session_expires_at || account.session_expires_at < new Date()) {
    throw new AuthError('Session has expired')
  }

  request.accountId = account.id
  request.environment = 'test'
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request)

  if (isApiKey(token)) {
    await authenticateWithApiKey(request, token)
  } else {
    await authenticateWithSessionToken(request, token)
  }
}
