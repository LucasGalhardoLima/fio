import type { Kysely } from 'kysely'
import type {
  Database,
  InvoiceRow,
  NewInvoice,
  InvoiceUpdate,
} from '../types.js'

export async function insertInvoice(
  db: Kysely<Database>,
  invoice: NewInvoice,
): Promise<InvoiceRow> {
  return db
    .insertInto('invoices')
    .values(invoice)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findInvoiceById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<InvoiceRow | undefined> {
  return db
    .selectFrom('invoices')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function findInvoicesBySubscription(
  db: Kysely<Database>,
  subscriptionId: string,
  accountId: string,
  environment: string,
): Promise<InvoiceRow[]> {
  return db
    .selectFrom('invoices')
    .selectAll()
    .where('subscription_id', '=', subscriptionId)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .orderBy('created_at', 'desc')
    .execute()
}

export async function updateInvoiceStatus(
  db: Kysely<Database>,
  id: string,
  status: string,
  updates?: InvoiceUpdate,
): Promise<InvoiceRow> {
  return db
    .updateTable('invoices')
    .set({ ...updates, status })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

interface InvoiceFilters {
  subscription_id?: string
  status?: string
}

export async function listInvoicesWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
  filters?: InvoiceFilters,
): Promise<InvoiceRow[]> {
  let query = db
    .selectFrom('invoices')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  if (filters?.subscription_id !== undefined) {
    query = query.where('subscription_id', '=', filters.subscription_id)
  }

  if (filters?.status !== undefined) {
    query = query.where('status', '=', filters.status)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}
