import { Worker } from 'bullmq'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import {
  findSubscriptionsDueForBilling,
  findTrialExpirations,
} from '../db/queries/subscriptions.js'
import { findPlanById } from '../db/queries/plans.js'
import { findCustomerById } from '../db/queries/customers.js'
import { insertInvoice } from '../db/queries/invoices.js'
import { transitionSubscription } from '../domain/subscription-state-machine.js'
import { transitionInvoice } from '../domain/invoice-state-machine.js'
import { createCharge } from '../services/charge-service.js'
import {
  SUBSCRIPTION_STATUS,
  INVOICE_STATUS,
  CANCELLATION_REASON,
} from '@fio-pay/shared'
import type { PaymentProvider } from '../providers/payment-provider.js'

interface BillingCycleOptions {
  provider: PaymentProvider
  pixKey: string
}

/**
 * Calculate the next period end date based on the plan interval.
 */
function calculateNextPeriodEnd(current: Date, interval: string): Date {
  const next = new Date(current)
  switch (interval) {
    case 'week':
      next.setDate(next.getDate() + 7)
      break
    case 'month':
      next.setMonth(next.getMonth() + 1)
      break
    case 'year':
      next.setFullYear(next.getFullYear() + 1)
      break
    default:
      next.setMonth(next.getMonth() + 1)
  }
  return next
}

/**
 * Start the billing cycle worker.
 *
 * Responsibilities:
 * 1. Query subscriptions due for billing (current_period_end <= now, status=active)
 *    - For each: create invoice + charge, advance period dates
 *    - If cancel_at_period_end is set, transition to canceled instead
 * 2. Check for trial expirations (trial_end <= now, status=trialing)
 *    - Transition to active, generate first charge
 */
export function startBillingCycleWorker(opts: BillingCycleOptions): Worker {
  const { provider, pixKey } = opts

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker(
    QUEUE_NAMES.BILLING_CYCLE,
    async () => {
      const db = getDatabase()
      let billingProcessed = 0
      let trialsProcessed = 0

      // --- 1. Process subscriptions due for billing ---
      const dueSubs = await findSubscriptionsDueForBilling(db)

      for (const sub of dueSubs) {
        try {
          // If marked for cancellation at period end, cancel now
          if (sub.cancel_at_period_end) {
            await transitionSubscription(
              db,
              sub.id,
              SUBSCRIPTION_STATUS.CANCELED,
              {
                canceled_at: new Date(),
                cancellation_reason: CANCELLATION_REASON.DEVELOPER_REQUEST,
              },
            )
            billingProcessed += 1
            continue
          }

          const plan = await findPlanById(
            db, sub.plan_id, sub.account_id, sub.environment,
          )
          if (!plan) {
            console.error(`Plan not found for subscription ${sub.id}: ${sub.plan_id}`)
            continue
          }

          const newPeriodStart = sub.current_period_end
          const newPeriodEnd = calculateNextPeriodEnd(newPeriodStart, plan.interval)

          // Create invoice for the new period
          const invoice = await insertInvoice(db, {
            account_id: sub.account_id,
            environment: sub.environment,
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            charge_id: null,
            amount: plan.amount,
            status: INVOICE_STATUS.DRAFT,
            period_start: newPeriodStart,
            period_end: newPeriodEnd,
            due_date: newPeriodStart,
            paid_at: null,
          })

          // Transition invoice from draft -> open
          const openInvoice = await transitionInvoice(
            db, invoice.id, INVOICE_STATUS.OPEN,
          )

          // Try Pix Automático if subscription has it enabled
          let charge
          let usedAutomaticDebit = false

          if (sub.pix_automatico && provider.createAutomaticCharge) {
            const customer = await findCustomerById(
              db, sub.customer_id, sub.account_id, sub.environment,
            )
            if (
              customer?.pix_automatico_consent_status === 'authorized' &&
              customer.pix_automatico_consent_id
            ) {
              try {
                const result = await provider.createAutomaticCharge({
                  consentId: customer.pix_automatico_consent_id,
                  amount: plan.amount,
                  scheduledDate: newPeriodEnd,
                })
                charge = await createCharge(db, provider, {
                  account_id: sub.account_id,
                  environment: sub.environment,
                  customer_id: sub.customer_id,
                  amount: plan.amount,
                  expires_in: 3600,
                  pix_key: pixKey,
                  invoice_id: openInvoice.id,
                })
                usedAutomaticDebit = true
                void result // Automatic charge was initiated
              } catch {
                // Fall through to QR code generation
              }
            }
          }

          // Fallback to QR code charge
          if (!usedAutomaticDebit) {
            charge = await createCharge(db, provider, {
              account_id: sub.account_id,
              environment: sub.environment,
              customer_id: sub.customer_id,
              amount: plan.amount,
              expires_in: 3600,
              pix_key: pixKey,
              invoice_id: openInvoice.id,
            })
          }

          // Link charge to invoice
          if (charge) {
            await db
              .updateTable('invoices')
              .set({ charge_id: charge.id })
              .where('id', '=', openInvoice.id)
              .execute()
          }

          // Advance subscription period dates
          await db
            .updateTable('subscriptions')
            .set({
              current_period_start: newPeriodStart,
              current_period_end: newPeriodEnd,
              updated_at: new Date(),
            })
            .where('id', '=', sub.id)
            .execute()

          billingProcessed += 1
        } catch (error) {
          console.error(
            `Failed to process billing for subscription ${sub.id}:`,
            error instanceof Error ? error.message : 'Unknown error',
          )
        }
      }

      // --- 2. Process trial expirations ---
      const expiredTrials = await findTrialExpirations(db)

      for (const sub of expiredTrials) {
        try {
          const plan = await findPlanById(
            db, sub.plan_id, sub.account_id, sub.environment,
          )
          if (!plan) {
            console.error(`Plan not found for subscription ${sub.id}: ${sub.plan_id}`)
            continue
          }

          const now = new Date()
          const periodEnd = calculateNextPeriodEnd(now, plan.interval)

          // Transition trialing -> active via state machine
          await transitionSubscription(
            db,
            sub.id,
            SUBSCRIPTION_STATUS.ACTIVE,
            {
              current_period_start: now,
              current_period_end: periodEnd,
              trial_end: null,
            },
          )

          // Generate first charge for the now-active subscription
          const invoice = await insertInvoice(db, {
            account_id: sub.account_id,
            environment: sub.environment,
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            charge_id: null,
            amount: plan.amount,
            status: INVOICE_STATUS.DRAFT,
            period_start: now,
            period_end: periodEnd,
            due_date: now,
            paid_at: null,
          })

          const openInvoice = await transitionInvoice(
            db, invoice.id, INVOICE_STATUS.OPEN,
          )

          const charge = await createCharge(db, provider, {
            account_id: sub.account_id,
            environment: sub.environment,
            customer_id: sub.customer_id,
            amount: plan.amount,
            expires_in: 3600,
            pix_key: pixKey,
            invoice_id: openInvoice.id,
          })

          await db
            .updateTable('invoices')
            .set({ charge_id: charge.id })
            .where('id', '=', openInvoice.id)
            .execute()

          trialsProcessed += 1
        } catch (error) {
          console.error(
            `Failed to process trial expiration for subscription ${sub.id}:`,
            error instanceof Error ? error.message : 'Unknown error',
          )
        }
      }

      return { billingProcessed, trialsProcessed }
    },
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
