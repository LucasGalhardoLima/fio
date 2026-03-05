import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type {
  Database,
  WebhookEndpointRow,
  NewWebhookEndpoint,
} from '../types.js'

export async function insertWebhookEndpoint(
  db: Kysely<Database>,
  endpoint: NewWebhookEndpoint,
): Promise<WebhookEndpointRow> {
  return db
    .insertInto('webhook_endpoints')
    .values(endpoint)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findWebhookEndpointById(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<WebhookEndpointRow | undefined> {
  return db
    .selectFrom('webhook_endpoints')
    .selectAll()
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .executeTakeFirst()
}

export async function findActiveEndpoints(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
): Promise<WebhookEndpointRow[]> {
  return db
    .selectFrom('webhook_endpoints')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('active', '=', true)
    .orderBy('id', 'asc')
    .execute()
}

/**
 * Find active endpoints that match a given event type.
 * An endpoint matches if:
 * - event_types is NULL (subscribed to all events), OR
 * - event_types array contains the given event type
 *
 * PostgreSQL array containment: event_types @> ARRAY[eventType]
 */
export async function findMatchingEndpoints(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  eventType: string,
): Promise<WebhookEndpointRow[]> {
  return db
    .selectFrom('webhook_endpoints')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('active', '=', true)
    .where((eb) =>
      eb.or([
        eb('event_types', 'is', null),
        sql<boolean>`event_types @> ARRAY[${eventType}]::text[]`,
      ]),
    )
    .orderBy('id', 'asc')
    .execute()
}

export async function deleteWebhookEndpoint(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<void> {
  await db
    .deleteFrom('webhook_endpoints')
    .where('id', '=', id)
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .execute()
}

export async function listWebhookEndpointsWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
): Promise<WebhookEndpointRow[]> {
  let query = db
    .selectFrom('webhook_endpoints')
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
