import type { Kysely } from 'kysely'
import type { Database, EventRow, NewEvent } from '../types.js'

export async function insertEvent(
  db: Kysely<Database>,
  event: NewEvent,
): Promise<EventRow> {
  return db
    .insertInto('events')
    .values(event)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function findEventById(
  db: Kysely<Database>,
  id: string,
): Promise<EventRow | undefined> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function listEventsByEntityId(
  db: Kysely<Database>,
  entityType: string,
  entityId: string,
): Promise<EventRow[]> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('entity_type', '=', entityType)
    .where('entity_id', '=', entityId)
    .orderBy('created_at', 'asc')
    .execute()
}

export async function listEventsByType(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  eventType: string,
  limit: number = 20,
  startingAfter?: string,
): Promise<EventRow[]> {
  let query = db
    .selectFrom('events')
    .selectAll()
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('event_type', '=', eventType)

  if (startingAfter !== undefined) {
    query = query.where('id', '>', startingAfter)
  }

  return query
    .orderBy('id', 'asc')
    .limit(limit)
    .execute()
}

export async function listEventsWithCursor(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  limit: number,
  startingAfter?: string,
): Promise<EventRow[]> {
  let query = db
    .selectFrom('events')
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
