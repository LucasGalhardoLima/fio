import crypto from 'node:crypto'
import type { Kysely } from 'kysely'
import type { PaginatedResponse } from '@fio-pay/shared'
import type { Database, WebhookEndpointRow, EventRow } from '../db/types.js'
import {
  insertWebhookEndpoint,
  findWebhookEndpointById,
  deleteWebhookEndpoint as deleteEndpointQuery,
  listWebhookEndpointsWithCursor,
  findMatchingEndpoints,
} from '../db/queries/webhook-endpoints.js'
import { insertWebhookDelivery } from '../db/queries/webhook-deliveries.js'
import { getBoss, QUEUE_NAMES } from '../jobs/queue-setup.js'
import { NotFoundError } from '../lib/errors.js'
import { paginateResults, normalizePaginationLimit } from '../lib/pagination.js'
import { MAX_WEBHOOK_ATTEMPTS } from '@fio-pay/shared'

interface RegisterEndpointParams {
  account_id: string
  environment: string
  url: string
  event_types: string[] | null
}

interface PaginationParams {
  limit?: number
  starting_after?: string
}

/**
 * Register a new webhook endpoint.
 * Generates a 32-byte hex signing secret that is returned once on creation.
 */
export async function registerEndpoint(
  db: Kysely<Database>,
  params: RegisterEndpointParams,
): Promise<WebhookEndpointRow> {
  const secret = crypto.randomBytes(32).toString('hex')

  const endpoint = await insertWebhookEndpoint(db, {
    account_id: params.account_id,
    environment: params.environment,
    url: params.url,
    secret,
    event_types: params.event_types,
  })

  return endpoint
}

/**
 * List webhook endpoints with cursor-based pagination.
 * Secrets are stripped from the response for security.
 */
export async function listEndpoints(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Omit<WebhookEndpointRow, 'secret'>>> {
  const limit = normalizePaginationLimit(pagination.limit)

  const rows = await listWebhookEndpointsWithCursor(
    db, accountId, environment, limit + 1, pagination.starting_after,
  )

  const result = paginateResults(rows, limit)

  // Strip secrets from the listed endpoints
  const sanitized = result.data.map((endpoint) => {
    const { secret: _secret, ...rest } = endpoint
    return rest
  })

  return {
    data: sanitized,
    has_more: result.has_more,
    next_cursor: result.next_cursor,
  }
}

/**
 * Delete a webhook endpoint by ID. Throws NotFoundError if not found.
 */
export async function deleteEndpoint(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<void> {
  const existing = await findWebhookEndpointById(db, id, accountId, environment)
  if (!existing) {
    throw new NotFoundError(`Webhook endpoint not found: ${id}`)
  }

  await deleteEndpointQuery(db, id, accountId, environment)
}

/**
 * Dispatch webhook delivery jobs for a newly created event.
 *
 * Finds all active endpoints matching the event type and enqueues
 * a delivery job for each.
 */
export async function dispatchEvent(
  db: Kysely<Database>,
  event: EventRow,
): Promise<void> {
  const endpoints = await findMatchingEndpoints(
    db,
    event.account_id,
    event.environment,
    event.event_type,
  )

  for (const endpoint of endpoints) {
    const delivery = await insertWebhookDelivery(db, {
      webhook_endpoint_id: endpoint.id,
      event_id: event.id,
      status: 'pending',
      next_attempt_at: new Date(),
      last_attempt_at: null,
      response_status_code: null,
      response_body: null,
      response_time_ms: null,
    })

    await getBoss().send(QUEUE_NAMES.WEBHOOK_DELIVERY, {
      delivery_id: delivery.id,
      endpoint_id: endpoint.id,
      endpoint_url: endpoint.url,
      endpoint_secret: endpoint.secret,
      event_id: event.id,
      event_type: event.event_type,
      event_data: event.data,
      account_id: event.account_id,
      environment: event.environment,
      attempt: 1,
      max_attempts: MAX_WEBHOOK_ATTEMPTS,
    })
  }
}
