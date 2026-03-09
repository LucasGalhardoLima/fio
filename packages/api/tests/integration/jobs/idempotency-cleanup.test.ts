import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import {
  createTestDatabase,
  createTestApp,
  createTestAccount,
  cleanupDatabase,
} from '../../helpers/setup.js'

describe('Idempotency Cleanup — business logic', () => {
  let db: Kysely<Database>
  let app: Awaited<ReturnType<typeof createTestApp>>
  let accountId: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
  })

  beforeEach(async () => {
    await sql`DELETE FROM idempotency_keys`.execute(db)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  async function insertIdempotencyKey(key: string, expiresAt: Date) {
    await db
      .insertInto('idempotency_keys')
      .values({
        account_id: accountId,
        key,
        method: 'POST',
        path: '/v1/charges',
        response_status: 201,
        response_body: { id: 'test' },
        expires_at: expiresAt,
      })
      .execute()
  }

  async function runCleanup() {
    return sql`DELETE FROM idempotency_keys WHERE expires_at < NOW()`.execute(
      db,
    )
  }

  async function countKeys() {
    const result = await db
      .selectFrom('idempotency_keys')
      .select(sql<number>`count(*)::int`.as('count'))
      .executeTakeFirstOrThrow()
    return result.count
  }

  it('deletes idempotency keys with past expires_at', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)
    await insertIdempotencyKey('expired-key', pastDate)

    await runCleanup()

    const remaining = await countKeys()
    expect(remaining).toBe(0)
  })

  it('preserves idempotency keys with future expires_at', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)
    await insertIdempotencyKey('valid-key', futureDate)

    await runCleanup()

    const remaining = await countKeys()
    expect(remaining).toBe(1)
  })

  it('handles mixed expired and valid keys', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)

    await insertIdempotencyKey('expired-1', pastDate)
    await insertIdempotencyKey('expired-2', pastDate)
    await insertIdempotencyKey('expired-3', pastDate)
    await insertIdempotencyKey('valid-1', futureDate)
    await insertIdempotencyKey('valid-2', futureDate)

    await runCleanup()

    const remaining = await countKeys()
    expect(remaining).toBe(2)
  })

  it('returns correct count of deleted keys', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)

    await insertIdempotencyKey('expired-1', pastDate)
    await insertIdempotencyKey('expired-2', pastDate)
    await insertIdempotencyKey('expired-3', pastDate)
    await insertIdempotencyKey('expired-4', pastDate)
    await insertIdempotencyKey('expired-5', pastDate)

    const result = await runCleanup()

    expect(result.numAffectedRows).toBe(BigInt(5))
  })
})
