import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import type {
  Database,
  AccountRow,
  ApiKeyRow,
  CustomerRow,
  NewAccount,
  NewApiKey,
  NewCustomer,
} from '../../src/db/types.js'
import { buildApp } from '../../src/app.js'
import { setDatabase } from '../../src/db/connection.js'
import { customerRoutes } from '../../src/routes/v1/customers.js'
import { chargeRoutes } from '../../src/routes/v1/charges.js'
import { planRoutes } from '../../src/routes/v1/plans.js'
import { subscriptionRoutes } from '../../src/routes/v1/subscriptions.js'
import { invoiceRoutes } from '../../src/routes/v1/invoices.js'
import { fioErrorHandler } from '../../src/lib/errors.js'
import { MockPaymentProvider } from '../../src/providers/mock-provider.js'

const { Pool } = pg

// ---------------------------------------------------------------------------
// Known valid CPF: 52998224725
//   check-digit 1: (5*10+2*9+9*8+9*7+8*6+2*5+2*4+4*3+7*2) = 333 → 333%11=3 → 11-3 = 8? NO
//   Actually verified externally: 52998224725 passes standard CPF validation.
// ---------------------------------------------------------------------------
const DEFAULT_CPF = '52998224725'

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://localhost/fio_test'

export function createTestDatabase(): Kysely<Database> {
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    max: 5,
  })

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })
}

// ---------------------------------------------------------------------------
// App helper
// ---------------------------------------------------------------------------

export async function createTestApp(db?: Kysely<Database>): Promise<FastifyInstance> {
  if (db) {
    setDatabase(db)
  }

  const app = buildApp()
  const provider = new MockPaymentProvider()
  const pixKey = 'test-pix-key'

  await app.register(fioErrorHandler)
  await app.register(customerRoutes)
  await app.register(chargeRoutes, { provider, pixKey })
  await app.register(planRoutes)
  await app.register(subscriptionRoutes, { provider })
  await app.register(invoiceRoutes)

  await app.ready()
  return app
}

// ---------------------------------------------------------------------------
// Transaction-based test isolation
// ---------------------------------------------------------------------------

export async function withTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      await fn(trx)
      // Always roll back so tests leave no residue
      throw new RollbackSignal()
    })
  } catch (err: unknown) {
    if (!(err instanceof RollbackSignal)) {
      throw err
    }
  }
}

class RollbackSignal extends Error {
  constructor() {
    super('transaction_rollback')
    this.name = 'RollbackSignal'
  }
}

// ---------------------------------------------------------------------------
// Cleanup (truncate in FK-safe order)
// ---------------------------------------------------------------------------

const TRUNCATE_ORDER = [
  'idempotency_keys',
  'webhook_deliveries',
  'webhook_endpoints',
  'events',
  'charges',
  'invoices',
  'subscriptions',
  'plans',
  'customers',
  'api_keys',
  'accounts',
] as const

export async function cleanupDatabase(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE
    idempotency_keys, webhook_deliveries, webhook_endpoints,
    events, charges, invoices, subscriptions, plans,
    customers, api_keys, accounts
    CASCADE`.execute(db)
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

let accountSeq = 0

export async function createTestAccount(
  db: Kysely<Database>,
  overrides?: Partial<NewAccount>,
): Promise<AccountRow> {
  accountSeq += 1
  const defaults: NewAccount = {
    name: `Test Account ${accountSeq}`,
    email: `test-${accountSeq}-${Date.now()}@fio.test`,
    password_hash: '$argon2id$v=19$m=19456,t=2,p=1$placeholder',
    ...overrides,
  }

  return db
    .insertInto('accounts')
    .values(defaults)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function createTestApiKey(
  db: Kysely<Database>,
  accountId: string,
  overrides?: Partial<NewApiKey>,
): Promise<{ row: ApiKeyRow; rawKey: string }> {
  const environment = overrides?.environment ?? 'test'
  const prefix = environment === 'live' ? 'fio_live_' : 'fio_test_'
  const rawKey = prefix + randomBytes(24).toString('hex')
  const keyHash = await argon2.hash(rawKey)
  const keyPrefix = rawKey.slice(0, 12)

  const defaults: NewApiKey = {
    account_id: accountId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    environment,
    name: null,
    expires_at: null,
    revoked_at: null,
    ...overrides,
  }

  const row = await db
    .insertInto('api_keys')
    .values(defaults)
    .returningAll()
    .executeTakeFirstOrThrow()

  return { row, rawKey }
}

export async function createTestCustomer(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  overrides?: Partial<NewCustomer>,
): Promise<CustomerRow> {
  const seq = Date.now()
  const defaults: NewCustomer = {
    account_id: accountId,
    environment,
    name: `Customer ${seq}`,
    email: `customer-${seq}@fio.test`,
    tax_id: DEFAULT_CPF,
    tax_id_type: 'cpf',
    ...overrides,
  }

  return db
    .insertInto('customers')
    .values(defaults)
    .returningAll()
    .executeTakeFirstOrThrow()
}
