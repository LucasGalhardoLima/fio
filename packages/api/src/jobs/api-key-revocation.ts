import { Worker } from 'bullmq'
import { getDatabase } from '../db/connection.js'
import { QUEUE_NAMES } from './queue-setup.js'

export function startApiKeyRevocationWorker(): Worker {
  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker(
    QUEUE_NAMES.API_KEY_REVOCATION,
    async () => {
      const db = getDatabase()

      const result = await db
        .updateTable('api_keys')
        .set({ revoked_at: new Date() })
        .where('expires_at', 'is not', null)
        .where('expires_at', '<', new Date())
        .where('revoked_at', 'is', null)
        .execute()

      const revoked = Number(result[0]?.numUpdatedRows ?? 0)
      if (revoked > 0) {
        console.log(`Auto-revoked ${revoked} expired API keys`)
      }

      return { revoked }
    },
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
