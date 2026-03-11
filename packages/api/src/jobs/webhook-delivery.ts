import PgBoss from 'pg-boss'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import { updateDeliveryAttempt } from '../db/queries/webhook-deliveries.js'
import { findEventById } from '../db/queries/events.js'
import { signPayload } from '../lib/hmac.js'
import { WEBHOOK_RETRY_SCHEDULE, MAX_WEBHOOK_ATTEMPTS } from '@fio-pay/shared'

interface WebhookDeliveryJobData {
  delivery_id: string
  endpoint_id: string
  endpoint_url: string
  endpoint_secret: string
  event_id: string
  event_type: string
  event_data: Record<string, unknown>
  account_id: string
  environment: string
  attempt: number
  max_attempts: number
}

/**
 * Truncate a string to a maximum length (for storing response bodies).
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength)
}

/**
 * POST the webhook payload to the endpoint URL.
 * Uses a 10-second timeout via AbortController.
 */
async function deliverWebhook(
  url: string,
  payload: string,
  signature: string,
): Promise<{ statusCode: number; body: string; responseTimeMs: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Fio-Signature': signature,
        'User-Agent': 'Fio-Webhooks/1.0',
      },
      body: payload,
      signal: controller.signal,
    })

    const responseTimeMs = Date.now() - startTime
    const body = await response.text()

    return {
      statusCode: response.status,
      body: truncate(body, 1024),
      responseTimeMs,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Process a single webhook delivery job.
 *
 * Responsibilities:
 * 1. POST the event payload to the endpoint URL with HMAC-SHA256 signature
 * 2. Record response (status code, body truncated to 1KB, response time)
 * 3. On success (2xx): update delivery status to 'delivered'
 * 4. On failure: schedule retry with exponential backoff
 * 5. After max attempts: mark delivery as 'failed'
 */
async function handleWebhookDelivery(
  boss: PgBoss,
  job: PgBoss.Job<WebhookDeliveryJobData>,
): Promise<void> {
  const data = job.data
  const db = getDatabase()

  // Build the payload
  const event = await findEventById(db, data.event_id)
  const payload = JSON.stringify({
    id: data.event_id,
    type: data.event_type,
    data: event?.data ?? data.event_data,
    created_at: event?.created_at ?? new Date().toISOString(),
  })

  // Sign the payload
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signPayload(payload, data.endpoint_secret, timestamp)

  let statusCode = 0
  let responseBody = ''
  let responseTimeMs = 0
  let success = false

  try {
    const result = await deliverWebhook(
      data.endpoint_url,
      payload,
      signature,
    )
    statusCode = result.statusCode
    responseBody = result.body
    responseTimeMs = result.responseTimeMs
    success = statusCode >= 200 && statusCode < 300
  } catch (error) {
    // Network error, timeout, etc.
    responseBody = error instanceof Error ? error.message : 'Unknown error'
    responseTimeMs = Date.now() - (timestamp * 1000)
  }

  const now = new Date()

  if (success) {
    // Mark as delivered
    await updateDeliveryAttempt(db, data.delivery_id, {
      status: 'delivered',
      attempts: data.attempt,
      last_attempt_at: now,
      next_attempt_at: null,
      response_status_code: statusCode,
      response_body: responseBody,
      response_time_ms: responseTimeMs,
    })
    return
  }

  // Delivery failed — check if we should retry
  if (data.attempt >= data.max_attempts) {
    // Max retries exhausted
    await updateDeliveryAttempt(db, data.delivery_id, {
      status: 'failed',
      attempts: data.attempt,
      last_attempt_at: now,
      next_attempt_at: null,
      response_status_code: statusCode > 0 ? statusCode : null,
      response_body: truncate(responseBody, 1024),
      response_time_ms: responseTimeMs > 0 ? responseTimeMs : null,
    })
    return
  }

  // Schedule retry with backoff
  const retryIndex = data.attempt - 1
  const delayMs = retryIndex < WEBHOOK_RETRY_SCHEDULE.length
    ? WEBHOOK_RETRY_SCHEDULE[retryIndex]
    : WEBHOOK_RETRY_SCHEDULE[WEBHOOK_RETRY_SCHEDULE.length - 1]

  const delaySeconds = (delayMs ?? 60_000) / 1000
  const nextAttemptAt = new Date(now.getTime() + (delayMs ?? 60_000))

  // Update delivery record
  await updateDeliveryAttempt(db, data.delivery_id, {
    attempts: data.attempt,
    last_attempt_at: now,
    next_attempt_at: nextAttemptAt,
    response_status_code: statusCode > 0 ? statusCode : null,
    response_body: truncate(responseBody, 1024),
    response_time_ms: responseTimeMs > 0 ? responseTimeMs : null,
  })

  // Enqueue the retry
  await boss.send(QUEUE_NAMES.WEBHOOK_DELIVERY, {
    ...data,
    attempt: data.attempt + 1,
  }, { startAfter: delaySeconds })
}

/**
 * Register the webhook delivery worker with pg-boss.
 */
export async function registerWebhookDeliveryWorker(boss: PgBoss): Promise<void> {
  await boss.work<WebhookDeliveryJobData>(
    QUEUE_NAMES.WEBHOOK_DELIVERY,
    async (jobs) => {
      const job = jobs[0]
      if (!job) return
      await handleWebhookDelivery(boss, job)
    },
  )
}
