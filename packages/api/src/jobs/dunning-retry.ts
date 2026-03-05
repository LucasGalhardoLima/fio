import { Worker, Queue } from 'bullmq'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import { findSubscriptionById } from '../db/queries/subscriptions.js'
import { findPlanById } from '../db/queries/plans.js'
import { findInvoiceById } from '../db/queries/invoices.js'
import { transitionSubscription } from '../domain/subscription-state-machine.js'
import { transitionInvoice } from '../domain/invoice-state-machine.js'
import { createCharge } from '../services/charge-service.js'
import {
  SUBSCRIPTION_STATUS,
  INVOICE_STATUS,
  CANCELLATION_REASON,
} from '@fio-pay/shared'
import type { PaymentProvider } from '../providers/payment-provider.js'

interface DunningJobData {
  subscription_id: string
  invoice_id: string
  account_id: string
  environment: string
  retry_index: number
}

interface DunningRetryOptions {
  provider: PaymentProvider
  pixKey: string
}

/**
 * Schedule a dunning retry for a failed charge.
 *
 * Reads the dunning_schedule from the subscription's plan and
 * queues the next retry with an appropriate delay.
 */
export async function scheduleDunningRetry(
  queue: Queue,
  data: DunningJobData,
): Promise<void> {
  const db = getDatabase()

  const subscription = await findSubscriptionById(
    db,
    data.subscription_id,
    data.account_id,
    data.environment,
  )
  if (!subscription) {
    console.error(`Subscription not found for dunning: ${data.subscription_id}`)
    return
  }

  const plan = await findPlanById(
    db,
    subscription.plan_id,
    data.account_id,
    data.environment,
  )
  if (!plan) {
    console.error(`Plan not found for dunning: ${subscription.plan_id}`)
    return
  }

  const schedule = plan.dunning_schedule
  if (data.retry_index >= schedule.length) {
    // All retries exhausted: transition subscription to canceled
    await transitionSubscription(
      db,
      data.subscription_id,
      SUBSCRIPTION_STATUS.CANCELED,
      {
        canceled_at: new Date(),
        cancellation_reason: CANCELLATION_REASON.DUNNING_FAILED,
      },
    )
    return
  }

  // Schedule the retry with delay based on dunning_schedule (days -> ms)
  const delayDays = schedule[data.retry_index]
  if (delayDays === undefined) {
    return
  }

  const delayMs = delayDays * 24 * 60 * 60 * 1000

  await queue.add(
    'dunning-retry',
    data,
    { delay: delayMs },
  )
}

/**
 * Start the dunning retry worker.
 *
 * On each retry:
 * 1. Look up subscription, plan, and invoice
 * 2. Create a new PIX charge for the invoice amount
 * 3. If all retries exhausted, cancel the subscription with reason=dunning_failed
 */
export function startDunningRetryWorker(opts: DunningRetryOptions): Worker<DunningJobData> {
  const { provider, pixKey } = opts

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker<DunningJobData>(
    QUEUE_NAMES.DUNNING_RETRY,
    async (job) => {
      const db = getDatabase()
      const data = job.data

      const subscription = await findSubscriptionById(
        db,
        data.subscription_id,
        data.account_id,
        data.environment,
      )
      if (!subscription) {
        throw new Error(`Subscription not found: ${data.subscription_id}`)
      }

      // If subscription is no longer past_due (e.g., already canceled), skip
      if (subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE) {
        return { skipped: true, reason: `Subscription status is ${subscription.status}` }
      }

      const plan = await findPlanById(
        db,
        subscription.plan_id,
        data.account_id,
        data.environment,
      )
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.plan_id}`)
      }

      const schedule = plan.dunning_schedule

      // Check if all retries are exhausted
      if (data.retry_index >= schedule.length) {
        await transitionSubscription(
          db,
          data.subscription_id,
          SUBSCRIPTION_STATUS.CANCELED,
          {
            canceled_at: new Date(),
            cancellation_reason: CANCELLATION_REASON.DUNNING_FAILED,
          },
        )
        return { canceled: true, reason: 'dunning_exhausted' }
      }

      const invoice = await findInvoiceById(
        db,
        data.invoice_id,
        data.account_id,
        data.environment,
      )
      if (!invoice) {
        throw new Error(`Invoice not found: ${data.invoice_id}`)
      }

      // Create a new charge for the retry
      const charge = await createCharge(db, provider, {
        account_id: data.account_id,
        environment: data.environment,
        customer_id: subscription.customer_id,
        amount: invoice.amount,
        expires_in: 3600,
        pix_key: pixKey,
        invoice_id: invoice.id,
      })

      // Link the new charge to the invoice
      await db
        .updateTable('invoices')
        .set({ charge_id: charge.id })
        .where('id', '=', invoice.id)
        .execute()

      return {
        retried: true,
        retry_index: data.retry_index,
        charge_id: charge.id,
      }
    },
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
