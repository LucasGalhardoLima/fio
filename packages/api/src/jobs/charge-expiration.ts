import PgBoss from 'pg-boss'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import { findExpiredPendingCharges } from '../db/queries/charges.js'
import { transitionCharge } from '../domain/charge-state-machine.js'
import { CHARGE_STATUS } from '@fio-pay/shared'

/**
 * Register the charge expiration worker with pg-boss.
 *
 * Schedules a cron job that runs every minute to find
 * pending charges past their expiration time and transition
 * them to the expired state.
 */
export async function registerChargeExpirationWorker(boss: PgBoss): Promise<void> {
  await boss.work(
    QUEUE_NAMES.CHARGE_EXPIRATION,
    async () => {
      const db = getDatabase()
      const expiredCharges = await findExpiredPendingCharges(db)

      for (const charge of expiredCharges) {
        try {
          await transitionCharge(db, charge.id, CHARGE_STATUS.EXPIRED)
        } catch (error) {
          console.error(
            `Failed to expire charge ${charge.id}:`,
            error instanceof Error ? error.message : 'Unknown error',
          )
        }
      }

      return { processed: expiredCharges.length }
    },
  )

  await boss.schedule(QUEUE_NAMES.CHARGE_EXPIRATION, '*/1 * * * *')
}
