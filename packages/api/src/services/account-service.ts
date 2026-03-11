import type { Kysely } from 'kysely'
import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import type { Database, AccountRow, ApiKeyRow } from '../db/types.js'
import { ConflictError, AuthError, NotFoundError } from '../lib/errors.js'

const KEY_PREFIX_LENGTH = 12
const SESSION_TOKEN_PREFIX_LENGTH = 12
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function generateApiKey(environment: 'test' | 'live'): string {
  const prefix = environment === 'test' ? 'fio_test_' : 'fio_live_'
  const random = randomBytes(24).toString('base64url')
  return `${prefix}${random}`
}

export interface RegisterResult {
  account: AccountRow
  testKey: string
  liveKey: string
}

export interface LoginResult {
  account: Omit<AccountRow, 'password_hash'>
  sessionToken: string
}

export async function registerAccount(
  db: Kysely<Database>,
  params: { name: string; email: string; password: string },
): Promise<RegisterResult> {
  const existing = await db
    .selectFrom('accounts')
    .select('id')
    .where('email', '=', params.email)
    .executeTakeFirst()

  if (existing) {
    throw new ConflictError('An account with this email already exists')
  }

  const passwordHash = await argon2.hash(params.password)

  const account = await db
    .insertInto('accounts')
    .values({
      name: params.name,
      email: params.email,
      password_hash: passwordHash,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // Generate initial test and live API keys
  const testKeyRaw = generateApiKey('test')
  const liveKeyRaw = generateApiKey('live')

  const testKeyHash = await argon2.hash(testKeyRaw)
  const liveKeyHash = await argon2.hash(liveKeyRaw)

  await db
    .insertInto('api_keys')
    .values([
      {
        account_id: account.id,
        key_hash: testKeyHash,
        key_prefix: testKeyRaw.slice(0, KEY_PREFIX_LENGTH),
        environment: 'test',
        name: 'Default test key',
      },
      {
        account_id: account.id,
        key_hash: liveKeyHash,
        key_prefix: liveKeyRaw.slice(0, KEY_PREFIX_LENGTH),
        environment: 'live',
        name: 'Default live key',
      },
    ])
    .execute()

  return { account, testKey: testKeyRaw, liveKey: liveKeyRaw }
}

export async function loginAccount(
  db: Kysely<Database>,
  params: { email: string; password: string },
): Promise<LoginResult> {
  const account = await db
    .selectFrom('accounts')
    .selectAll()
    .where('email', '=', params.email)
    .executeTakeFirst()

  if (!account) {
    throw new AuthError('Invalid email or password')
  }

  const isValid = await argon2.verify(account.password_hash, params.password)
  if (!isValid) {
    throw new AuthError('Invalid email or password')
  }

  // Generate a session token and persist hash + prefix for lookup
  const sessionToken = randomBytes(32).toString('base64url')
  const sessionTokenHash = await argon2.hash(sessionToken)
  const sessionTokenPrefix = sessionToken.slice(0, SESSION_TOKEN_PREFIX_LENGTH)
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db
    .updateTable('accounts')
    .set({
      session_token_hash: sessionTokenHash,
      session_token_prefix: sessionTokenPrefix,
      session_expires_at: sessionExpiresAt,
      updated_at: new Date(),
    })
    .where('id', '=', account.id)
    .execute()

  const { password_hash: _, ...safeAccount } = account

  return { account: safeAccount, sessionToken }
}

export async function generateApiKeyForAccount(
  db: Kysely<Database>,
  accountId: string,
  environment: 'test' | 'live',
  name?: string,
): Promise<{ apiKey: ApiKeyRow; rawKey: string }> {
  const rawKey = generateApiKey(environment)
  const keyHash = await argon2.hash(rawKey)

  const apiKey = await db
    .insertInto('api_keys')
    .values({
      account_id: accountId,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
      environment,
      name: name ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return { apiKey, rawKey }
}

export async function listApiKeys(
  db: Kysely<Database>,
  accountId: string,
): Promise<Array<Omit<ApiKeyRow, 'key_hash'>>> {
  const keys = await db
    .selectFrom('api_keys')
    .selectAll()
    .where('account_id', '=', accountId)
    .orderBy('created_at', 'desc')
    .execute()

  return keys.map(({ key_hash: _, ...rest }) => rest)
}

export async function revokeApiKey(
  db: Kysely<Database>,
  keyId: string,
  accountId: string,
): Promise<void> {
  const key = await db
    .selectFrom('api_keys')
    .select(['id', 'account_id', 'revoked_at'])
    .where('id', '=', keyId)
    .where('account_id', '=', accountId)
    .executeTakeFirst()

  if (!key) {
    throw new NotFoundError(`API key not found: ${keyId}`)
  }

  if (key.revoked_at) {
    return // Already revoked
  }

  await db
    .updateTable('api_keys')
    .set({ revoked_at: new Date() })
    .where('id', '=', keyId)
    .execute()
}
