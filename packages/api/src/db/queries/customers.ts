import type { Kysely } from 'kysely'
import type {
  Database,
  CustomerRow,
  NewCustomer,
  CustomerUpdate,
} from '../types.js'

export async function insertCustomer(
  db: Kysely<Database>,
  customer: NewCustomer,
): Promise<CustomerRow> {
  return db
    .insertInto('customers')
    .values(customer)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findCustomerById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<CustomerRow | undefined> {
  return db
    .selectFrom('customers')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function findCustomerByEmail(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  email: string,
): Promise<CustomerRow | undefined> {
  return db
    .selectFrom('customers')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('email', '=', email)
    .executeTakeFirst()
}

export async function findCustomerByTaxId(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  taxId: string,
): Promise<CustomerRow | undefined> {
  return db
    .selectFrom('customers')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('tax_id', '=', taxId)
    .executeTakeFirst()
}

export async function updateCustomer(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
  updates: CustomerUpdate,
): Promise<CustomerRow> {
  return db
    .updateTable('customers')
    .set({ ...updates, updated_at: new Date() })
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteCustomer(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<void> {
  await db
    .deleteFrom('customers')
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .execute()
}

export async function listCustomersWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
): Promise<CustomerRow[]> {
  let query = db
    .selectFrom('customers')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}
