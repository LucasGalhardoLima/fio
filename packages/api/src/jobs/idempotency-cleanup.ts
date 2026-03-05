import { Worker } from 'bullmq'
import { sql } from 'kysely'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'

export function startIdempotencyCleanupWorker(): Worker {
  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker(
    QUEUE_NAMES.IDEMPOTENCY_CLEANUP,
    async () => {
      const db = getDatabase()

      const result = await sql`
        DELETE FROM idempotency_keys
        WHERE expires_at < NOW()
      `.execute(db)

      const deleted = Number(result.numAffectedRows ?? 0)
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} expired idempotency keys`)
      }

      return { deleted }
    },
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
