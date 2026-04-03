import PgBoss from 'pg-boss'
import { sql } from 'kysely'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'

/**
 * Register the idempotency cleanup worker with pg-boss.
 *
 * Schedules a cron job that runs every hour to delete
 * expired idempotency keys from the database.
 */
export async function registerIdempotencyCleanupWorker(boss: PgBoss): Promise<void> {
  await boss.work(
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
  )

  await boss.schedule(QUEUE_NAMES.IDEMPOTENCY_CLEANUP, '0 * * * *')
}
