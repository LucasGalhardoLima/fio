import { Queue } from 'bullmq'

function getRedisUrl(): string {
  const url = process.env['REDIS_URL']
  if (!url) {
    throw new Error('REDIS_URL environment variable is required for job queues')
  }
  return url
}

function getConnectionOptions(): { url: string; maxRetriesPerRequest: null } {
  return {
    url: getRedisUrl(),
    maxRetriesPerRequest: null,
  }
}

export const QUEUE_NAMES = {
  BILLING_CYCLE: 'billing-cycle',
  DUNNING_RETRY: 'dunning-retry',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  PIX_AUTOMATICO_CONSENT: 'pix-automatico-consent',
  CHARGE_EXPIRATION: 'charge-expiration',
  IDEMPOTENCY_CLEANUP: 'idempotency-cleanup',
  API_KEY_REVOCATION: 'api-key-revocation',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  })
}

const queues = new Map<QueueName, Queue>()

function getQueue(name: QueueName): Queue {
  let queue = queues.get(name)
  if (!queue) {
    queue = createQueue(name)
    queues.set(name, queue)
  }
  return queue
}

export function getBillingCycleQueue(): Queue { return getQueue(QUEUE_NAMES.BILLING_CYCLE) }
export function getDunningRetryQueue(): Queue { return getQueue(QUEUE_NAMES.DUNNING_RETRY) }
export function getWebhookDeliveryQueue(): Queue { return getQueue(QUEUE_NAMES.WEBHOOK_DELIVERY) }
export function getPixAutomaticoConsentQueue(): Queue { return getQueue(QUEUE_NAMES.PIX_AUTOMATICO_CONSENT) }
export function getChargeExpirationQueue(): Queue { return getQueue(QUEUE_NAMES.CHARGE_EXPIRATION) }
export function getIdempotencyCleanupQueue(): Queue { return getQueue(QUEUE_NAMES.IDEMPOTENCY_CLEANUP) }
export function getApiKeyRevocationQueue(): Queue { return getQueue(QUEUE_NAMES.API_KEY_REVOCATION) }

export async function closeQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close())
  await Promise.all(closePromises)
  queues.clear()
}
