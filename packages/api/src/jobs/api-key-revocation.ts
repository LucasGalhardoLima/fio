import PgBoss from 'pg-boss'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'

/**
 * Register the API key revocation worker with pg-boss.
 *
 * Schedules a cron job that runs every hour to auto-revoke
 * API keys that have passed their expiration date.
 */
export async function registerApiKeyRevocationWorker(boss: PgBoss): Promise<void> {
  await boss.work(
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
  )

  await boss.schedule(QUEUE_NAMES.API_KEY_REVOCATION, '0 * * * *')
}
