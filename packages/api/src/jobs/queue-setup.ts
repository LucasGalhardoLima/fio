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

export const billingCycleQueue = createQueue(QUEUE_NAMES.BILLING_CYCLE)
export const dunningRetryQueue = createQueue(QUEUE_NAMES.DUNNING_RETRY)
export const webhookDeliveryQueue = createQueue(QUEUE_NAMES.WEBHOOK_DELIVERY)
export const pixAutomaticoConsentQueue = createQueue(QUEUE_NAMES.PIX_AUTOMATICO_CONSENT)
export const chargeExpirationQueue = createQueue(QUEUE_NAMES.CHARGE_EXPIRATION)
export const idempotencyCleanupQueue = createQueue(QUEUE_NAMES.IDEMPOTENCY_CLEANUP)
export const apiKeyRevocationQueue = createQueue(QUEUE_NAMES.API_KEY_REVOCATION)

export async function closeQueues(): Promise<void> {
  await Promise.all([
    billingCycleQueue.close(),
    dunningRetryQueue.close(),
    webhookDeliveryQueue.close(),
    pixAutomaticoConsentQueue.close(),
    chargeExpirationQueue.close(),
    idempotencyCleanupQueue.close(),
    apiKeyRevocationQueue.close(),
  ])
}
