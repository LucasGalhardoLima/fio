import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type {
  Database,
  WebhookDeliveryRow,
  NewWebhookDelivery,
  WebhookDeliveryUpdate,
} from '../types.js'

export async function insertWebhookDelivery(
  db: Kysely<Database>,
  delivery: NewWebhookDelivery,
): Promise<WebhookDeliveryRow> {
  return db
    .insertInto('webhook_deliveries')
    .values(delivery)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findWebhookDeliveryById(
  db: Kysely<Database>,
  id: string,
): Promise<WebhookDeliveryRow | undefined> {
  return db
    .selectFrom('webhook_deliveries')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function updateDeliveryAttempt(
  db: Kysely<Database>,
  id: string,
  updates: WebhookDeliveryUpdate,
): Promise<WebhookDeliveryRow> {
  return db
    .updateTable('webhook_deliveries')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Find deliveries that are pending retry and whose next_attempt_at
 * has passed. These are ready to be retried.
 */
export async function findPendingRetries(
  db: Kysely<Database>,
): Promise<WebhookDeliveryRow[]> {
  return db
    .selectFrom('webhook_deliveries')
    .selectAll()
    .where('status', '=', 'pending')
    .where('next_attempt_at', '<=', sql<Date>`now()`)
    .orderBy('next_attempt_at', 'asc')
    .execute()
}

interface WebhookDeliveryFilters {
  webhook_endpoint_id?: string
  event_id?: string
  status?: string
}

export async function listWebhookDeliveriesWithCursor(
  db: Kysely<Database>,
  limit: number,
  startingAfter?: string,
  filters?: WebhookDeliveryFilters,
): Promise<WebhookDeliveryRow[]> {
  let query = db
    .selectFrom('webhook_deliveries')
    .selectAll()

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  if (filters?.webhook_endpoint_id !== undefined) {
    query = query.where('webhook_endpoint_id', '=', filters.webhook_endpoint_id)
  }

  if (filters?.event_id !== undefined) {
    query = query.where('event_id', '=', filters.event_id)
  }

  if (filters?.status !== undefined) {
    query = query.where('status', '=', filters.status)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}
