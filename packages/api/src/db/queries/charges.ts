import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type {
  Database,
  ChargeRow,
  NewCharge,
  ChargeUpdate,
} from '../types.js'

export async function insertCharge(
  db: Kysely<Database>,
  charge: NewCharge,
): Promise<ChargeRow> {
  return db
    .insertInto('charges')
    .values(charge)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findChargeById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<ChargeRow | undefined> {
  return db
    .selectFrom('charges')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function findChargeByProviderRef(
  db: Kysely<Database>,
  provider: string,
  providerRef: string,
): Promise<ChargeRow | undefined> {
  return db
    .selectFrom('charges')
    .selectAll()
    .where('provider', '=', provider)
    .where('provider_reference', '=', providerRef)
    .executeTakeFirst()
}

export async function updateChargeStatus(
  db: Kysely<Database>,
  id: string,
  status: string,
  updates?: ChargeUpdate,
): Promise<ChargeRow> {
  return db
    .updateTable('charges')
    .set({ ...updates, status })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

interface ChargeFilters {
  status?: string
  customer_id?: string
}

export async function listChargesWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
  filters?: ChargeFilters,
): Promise<ChargeRow[]> {
  let query = db
    .selectFrom('charges')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  if (filters?.status !== undefined) {
    query = query.where('status', '=', filters.status)
  }

  if (filters?.customer_id !== undefined) {
    query = query.where('customer_id', '=', filters.customer_id)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}

export async function findExpiredPendingCharges(
  db: Kysely<Database>,
): Promise<ChargeRow[]> {
  return db
    .selectFrom('charges')
    .selectAll()
    .where('status', '=', 'pending')
    .where('expires_at', '<=', sql<Date>`now()`)
    .execute()
}
