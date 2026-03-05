import type { Kysely } from 'kysely'
import type { Database, EventRow } from '../db/types.js'
import { insertEvent } from '../db/queries/events.js'
import { dispatchEvent } from './webhook-service.js'

interface CreateEventParams {
  account_id: string
  environment: string
  event_type: string
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
  idempotency_key?: string
}

/**
 * Create an event in the append-only event log.
 * After persisting the event, dispatches webhook delivery jobs
 * to all matching webhook endpoints.
 */
export async function createEvent(
  db: Kysely<Database>,
  params: CreateEventParams,
): Promise<EventRow> {
  const event = await insertEvent(db, {
    account_id: params.account_id,
    environment: params.environment,
    event_type: params.event_type,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    data: params.data,
    metadata: params.metadata ?? {},
    idempotency_key: params.idempotency_key ?? null,
  })

  // Dispatch webhook deliveries to matching endpoints.
  // Errors in webhook dispatch should not fail the event creation,
  // so we catch and log any errors.
  try {
    await dispatchEvent(db, event)
  } catch (error) {
    // Log but don't fail: webhook dispatch is best-effort from the
    // event creation perspective
    console.error(
      'Failed to dispatch webhook for event',
      event.id,
      error instanceof Error ? error.message : 'Unknown error',
    )
  }

  return event
}
