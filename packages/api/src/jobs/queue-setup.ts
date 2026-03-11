import PgBoss from 'pg-boss'

let boss: PgBoss | null = null

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

function getDatabaseUrl(): string {
  const url = process.env['DATABASE_URL']
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required for job queues')
  }
  return url
}

export function getBoss(): PgBoss {
  if (!boss) {
    boss = new PgBoss({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    })
  }
  return boss
}

export async function startBoss(): Promise<void> {
  const instance = getBoss()
  await instance.start()

  // Create all queues (idempotent — no-ops if already exist)
  for (const name of Object.values(QUEUE_NAMES)) {
    await instance.createQueue(name)
  }
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop()
    boss = null
  }
}
