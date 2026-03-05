import type { Kysely } from 'kysely'
import type { PaginatedResponse, SubscriptionStatus } from '@fio-pay/shared'
import {
  SUBSCRIPTION_STATUS,
  INVOICE_STATUS,
  CHARGE_STATUS,
  EVENT_TYPES,
  ENTITY_TYPES,
  CANCELLATION_REASON,
} from '@fio-pay/shared'
import type { Database, SubscriptionRow, PlanRow } from '../db/types.js'
import type { PaymentProvider } from '../providers/payment-provider.js'
import {
  insertSubscription,
  findSubscriptionById,
  listSubscriptionsWithCursor,
} from '../db/queries/subscriptions.js'
import { findPlanById } from '../db/queries/plans.js'
import { findCustomerById } from '../db/queries/customers.js'
import { insertInvoice } from '../db/queries/invoices.js'
import { transitionSubscription } from '../domain/subscription-state-machine.js'
import { transitionInvoice } from '../domain/invoice-state-machine.js'
import { createCharge } from './charge-service.js'
import { createEvent } from './event-service.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { paginateResults, normalizePaginationLimit } from '../lib/pagination.js'

interface CreateSubscriptionParams {
  account_id: string
  environment: string
  customer_id: string
  plan_id: string
  pix_automatico?: boolean
  cancel_at_period_end?: boolean
  metadata?: Record<string, unknown>
}

interface SubscriptionWithPlan extends SubscriptionRow {
  plan: PlanRow
}

interface PaginationParams {
  limit?: number
  starting_after?: string
}

interface SubscriptionFilters {
  status?: string
  customer_id?: string
}

/**
 * Calculate the next period end date based on the plan interval.
 */
function calculatePeriodEnd(start: Date, interval: string): Date {
  const end = new Date(start)
  switch (interval) {
    case 'week':
      end.setDate(end.getDate() + 7)
      break
    case 'month':
      end.setMonth(end.getMonth() + 1)
      break
    case 'year':
      end.setFullYear(end.getFullYear() + 1)
      break
    default:
      end.setMonth(end.getMonth() + 1)
  }
  return end
}

/**
 * Create a subscription.
 *
 * - Looks up customer + plan
 * - Determines initial status (trialing if trial_days > 0, active otherwise)
 * - Calculates period dates
 * - If no trial, generates first charge + invoice
 * - Emits subscription.created event
 */
export async function createSubscription(
  db: Kysely<Database>,
  provider: PaymentProvider,
  params: CreateSubscriptionParams,
): Promise<SubscriptionRow> {
  const customer = await findCustomerById(
    db, params.customer_id, params.account_id, params.environment,
  )
  if (!customer) {
    throw new NotFoundError(`Customer not found: ${params.customer_id}`)
  }

  const plan = await findPlanById(
    db, params.plan_id, params.account_id, params.environment,
  )
  if (!plan) {
    throw new NotFoundError(`Plan not found: ${params.plan_id}`)
  }

  if (!plan.active) {
    throw new ValidationError('Cannot subscribe to an archived plan')
  }

  const now = new Date()
  const hasTrial = plan.trial_days > 0
  const initialStatus: SubscriptionStatus = hasTrial
    ? SUBSCRIPTION_STATUS.TRIALING
    : SUBSCRIPTION_STATUS.ACTIVE

  const periodStart = now
  const periodEnd = calculatePeriodEnd(now, plan.interval)
  const trialEnd = hasTrial
    ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000)
    : null

  const subscription = await insertSubscription(db, {
    account_id: params.account_id,
    environment: params.environment,
    customer_id: params.customer_id,
    plan_id: params.plan_id,
    status: initialStatus,
    current_period_start: periodStart,
    current_period_end: hasTrial ? trialEnd! : periodEnd,
    trial_end: trialEnd,
    cancel_at_period_end: params.cancel_at_period_end ?? false,
    canceled_at: null,
    cancellation_reason: null,
    paused_at: null,
    pix_automatico: params.pix_automatico ?? false,
    metadata: params.metadata ?? {},
  })

  await createEvent(db, {
    account_id: subscription.account_id,
    environment: subscription.environment,
    event_type: EVENT_TYPES.SUBSCRIPTION_CREATED,
    entity_type: ENTITY_TYPES.SUBSCRIPTION,
    entity_id: subscription.id,
    data: {
      subscription_id: subscription.id,
      customer_id: subscription.customer_id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      trial_days: plan.trial_days,
    },
  })

  // If no trial, generate first charge + invoice
  if (!hasTrial) {
    const invoice = await insertInvoice(db, {
      account_id: params.account_id,
      environment: params.environment,
      subscription_id: subscription.id,
      customer_id: params.customer_id,
      charge_id: null,
      amount: plan.amount,
      status: INVOICE_STATUS.DRAFT,
      period_start: periodStart,
      period_end: periodEnd,
      due_date: periodStart,
      paid_at: null,
    })

    // Transition invoice from draft -> open
    const openInvoice = await transitionInvoice(
      db, invoice.id, INVOICE_STATUS.OPEN,
    )

    // Create a PIX charge for the invoice
    const charge = await createCharge(db, provider, {
      account_id: params.account_id,
      environment: params.environment,
      customer_id: params.customer_id,
      amount: plan.amount,
      expires_in: 3600,
      pix_key: process.env['PIX_KEY'] ?? '',
      invoice_id: openInvoice.id,
    })

    // Link charge to invoice
    await db
      .updateTable('invoices')
      .set({ charge_id: charge.id })
      .where('id', '=', openInvoice.id)
      .execute()
  }

  return subscription
}

/**
 * Get a subscription by ID with plan data. Throws NotFoundError if not found.
 */
export async function getSubscription(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<SubscriptionWithPlan> {
  const subscription = await findSubscriptionById(db, id, accountId, environment)
  if (!subscription) {
    throw new NotFoundError(`Subscription not found: ${id}`)
  }

  const plan = await findPlanById(
    db, subscription.plan_id, accountId, environment,
  )
  if (!plan) {
    throw new NotFoundError(`Plan not found: ${subscription.plan_id}`)
  }

  return { ...subscription, plan }
}

/**
 * Cancel a subscription.
 *
 * If cancelAtPeriodEnd is true, sets the flag and the subscription
 * continues until the end of the current period.
 * Otherwise, transitions to canceled immediately via state machine.
 */
export async function cancelSubscription(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
  cancelAtPeriodEnd: boolean,
): Promise<SubscriptionRow> {
  const subscription = await findSubscriptionById(db, id, accountId, environment)
  if (!subscription) {
    throw new NotFoundError(`Subscription not found: ${id}`)
  }

  if (cancelAtPeriodEnd) {
    // Set flag; the billing cycle job handles the actual cancellation
    const updated = await db
      .updateTable('subscriptions')
      .set({ cancel_at_period_end: true, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return updated
  }

  // Immediate cancellation via state machine
  return transitionSubscription(
    db,
    id,
    SUBSCRIPTION_STATUS.CANCELED,
    {
      canceled_at: new Date(),
      cancellation_reason: CANCELLATION_REASON.DEVELOPER_REQUEST,
    },
  )
}

/**
 * Pause an active subscription. Sets status to paused and records pause timestamp.
 */
export async function pauseSubscription(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<SubscriptionRow> {
  const subscription = await findSubscriptionById(db, id, accountId, environment)
  if (!subscription) {
    throw new NotFoundError(`Subscription not found: ${id}`)
  }

  return transitionSubscription(db, id, SUBSCRIPTION_STATUS.PAUSED, {
    paused_at: new Date(),
  })
}

/**
 * Resume a paused subscription. Recalculates current_period_end from now.
 */
export async function resumeSubscription(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<SubscriptionRow> {
  const subscription = await findSubscriptionById(db, id, accountId, environment)
  if (!subscription) {
    throw new NotFoundError(`Subscription not found: ${id}`)
  }

  const plan = await findPlanById(db, subscription.plan_id, accountId, environment)
  if (!plan) {
    throw new NotFoundError(`Plan not found: ${subscription.plan_id}`)
  }

  const now = new Date()
  const newPeriodEnd = calculatePeriodEnd(now, plan.interval)

  return transitionSubscription(db, id, SUBSCRIPTION_STATUS.ACTIVE, {
    paused_at: null,
    current_period_start: now,
    current_period_end: newPeriodEnd,
  })
}

/**
 * List subscriptions with cursor-based pagination and optional filters.
 */
export async function listSubscriptions(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  pagination: PaginationParams,
  filters?: SubscriptionFilters,
): Promise<PaginatedResponse<SubscriptionRow>> {
  const limit = normalizePaginationLimit(pagination.limit)

  const rows = await listSubscriptionsWithCursor(
    db, accountId, environment, limit + 1, pagination.starting_after, filters,
  )

  return paginateResults(rows, limit)
}
