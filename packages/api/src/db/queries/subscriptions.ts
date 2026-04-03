import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type {
  Database,
  SubscriptionRow,
  NewSubscription,
  SubscriptionUpdate,
} from '../types.js'

export async function insertSubscription(
  db: Kysely<Database>,
  subscription: NewSubscription,
): Promise<SubscriptionRow> {
  return db
    .insertInto('subscriptions')
    .values(subscription)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findSubscriptionById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<SubscriptionRow | undefined> {
  return db
    .selectFrom('subscriptions')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function updateSubscriptionStatus(
  db: Kysely<Database>,
  id: string,
  status: string,
  updates?: SubscriptionUpdate,
): Promise<SubscriptionRow> {
  return db
    .updateTable('subscriptions')
    .set({ ...updates, status, updated_at: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Find subscriptions due for billing:
 * current_period_end <= now AND status = 'active'
 */
export async function findSubscriptionsDueForBilling(
  db: Kysely<Database>,
): Promise<SubscriptionRow[]> {
  return db
    .selectFrom('subscriptions')
    .selectAll()
    .where('status', '=', 'active')
    .where('current_period_end', '<=', sql<Date>`now()`)
    .execute()
}

/**
 * Find subscriptions with expired trials:
 * trial_end <= now AND status = 'trialing'
 */
export async function findTrialExpirations(
  db: Kysely<Database>,
): Promise<SubscriptionRow[]> {
  return db
    .selectFrom('subscriptions')
    .selectAll()
    .where('status', '=', 'trialing')
    .where('trial_end', '<=', sql<Date>`now()`)
    .execute()
}

interface SubscriptionFilters {
  status?: string
  customer_id?: string
}

export async function listSubscriptionsWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
  filters?: SubscriptionFilters,
): Promise<SubscriptionRow[]> {
  let query = db
    .selectFrom('subscriptions')
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

/**
 * Find active subscriptions for a customer (for delete validation).
 * Includes trialing, active, and past_due statuses.
 */
export async function findActiveSubscriptionsByCustomer(
  db: Kysely<Database>,
  customerId: string,
  accountId: string,
  environment: string,
): Promise<SubscriptionRow[]> {
  return db
    .selectFrom('subscriptions')
    .selectAll()
    .where('customer_id', '=', customerId)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('status', 'in', ['trialing', 'active', 'past_due'])
    .execute()
}
