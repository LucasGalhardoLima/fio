import { Worker } from 'bullmq'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import { findExpiredPendingCharges } from '../db/queries/charges.js'
import { transitionCharge } from '../domain/charge-state-machine.js'
import { CHARGE_STATUS } from '@fio-pay/shared'

export function startChargeExpirationWorker(): Worker {
  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker(
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
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
