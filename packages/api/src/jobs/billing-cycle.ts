import PgBoss from 'pg-boss'
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
 * Process subscriptions due for billing.
 */
async function processDueBilling(
  provider: PaymentProvider,
  pixKey: string,
): Promise<number> {
  const db = getDatabase()
  let billingProcessed = 0

  const dueSubs = await findSubscriptionsDueForBilling(db)

  for (const sub of dueSubs) {
    try {
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

      const openInvoice = await transitionInvoice(
        db, invoice.id, INVOICE_STATUS.OPEN,
      )

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
            void result
          } catch {
            // Fall through to QR code generation
          }
        }
      }

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

      if (charge) {
        await db
          .updateTable('invoices')
          .set({ charge_id: charge.id })
          .where('id', '=', openInvoice.id)
          .execute()
      }

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

  return billingProcessed
}

/**
 * Process trial expirations.
 */
async function processTrialExpirations(
  provider: PaymentProvider,
  pixKey: string,
): Promise<number> {
  const db = getDatabase()
  let trialsProcessed = 0

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

  return trialsProcessed
}

/**
 * Register the billing cycle worker with pg-boss.
 *
 * Schedules a cron job that runs every minute to:
 * 1. Bill subscriptions due for renewal
 * 2. Transition expired trials to active
 */
export async function registerBillingCycleWorker(
  boss: PgBoss,
  opts: BillingCycleOptions,
): Promise<void> {
  const { provider, pixKey } = opts

  await boss.work(
    QUEUE_NAMES.BILLING_CYCLE,
    async () => {
      const billingProcessed = await processDueBilling(provider, pixKey)
      const trialsProcessed = await processTrialExpirations(provider, pixKey)
      return { billingProcessed, trialsProcessed }
    },
  )

  await boss.schedule(QUEUE_NAMES.BILLING_CYCLE, '*/1 * * * *')
}
