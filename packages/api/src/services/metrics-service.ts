import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Metrics } from '@fio-pay/shared'
import { SUBSCRIPTION_STATUS } from '@fio-pay/shared'
import type { Database } from '../db/types.js'

/**
 * Normalize a subscription amount to a monthly value (in centavos).
 *
 * - week: amount * 4.33 (average weeks per month)
 * - month: amount (no change)
 * - year: amount / 12
 */
function normalizeToMonthly(amount: number, interval: string): number {
  switch (interval) {
    case 'week':
      return Math.round(amount * 4.33)
    case 'month':
      return amount
    case 'year':
      return Math.round(amount / 12)
    default:
      return amount
  }
}

/**
 * Calculate Monthly Recurring Revenue (MRR) in centavos.
 *
 * Sums all active subscription amounts, normalizing weekly and yearly
 * intervals to their monthly equivalent.
 */
export async function calculateMrr(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
): Promise<number> {
  const rows = await db
    .selectFrom('subscriptions')
    .innerJoin('plans', 'plans.id', 'subscriptions.plan_id')
    .select([
      'plans.amount',
      'plans.interval',
    ])
    .where('subscriptions.account_id', '=', accountId)
    .where('subscriptions.environment', '=', environment)
    .where('subscriptions.status', '=', SUBSCRIPTION_STATUS.ACTIVE)
    .execute()

  let mrr = 0
  for (const row of rows) {
    mrr += normalizeToMonthly(row.amount, row.interval)
  }

  return mrr
}

/**
 * Count the number of active subscriptions.
 */
export async function countActiveSubscriptions(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
): Promise<number> {
  const result = await db
    .selectFrom('subscriptions')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('status', '=', SUBSCRIPTION_STATUS.ACTIVE)
    .executeTakeFirstOrThrow()

  return result.count
}

/**
 * Calculate churn rate as a decimal.
 *
 * Formula: canceled_in_period / (active_now + canceled_in_period)
 *
 * A churn rate of 0 means no churn; 1 means all subscribers left.
 * Returns 0 if the denominator is zero (no subscriptions at all).
 */
export async function calculateChurnRate(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  periodDays: number = 30,
): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - periodDays)

  // Count subscriptions canceled within the period
  const canceledResult = await db
    .selectFrom('subscriptions')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('account_id', '=', accountId)
    .where('environment', '=', environment)
    .where('status', '=', SUBSCRIPTION_STATUS.CANCELED)
    .where('canceled_at', '>=', cutoff)
    .executeTakeFirstOrThrow()

  const canceledCount = canceledResult.count

  // Count currently active subscriptions
  const activeCount = await countActiveSubscriptions(db, accountId, environment)

  const denominator = activeCount + canceledCount
  if (denominator === 0) {
    return 0
  }

  // Return as decimal with reasonable precision
  return Math.round((canceledCount / denominator) * 10000) / 10000
}

/**
 * Calculate all dashboard metrics in a single call.
 */
export async function getMetrics(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  periodDays: number = 30,
): Promise<Metrics> {
  const [mrr, activeSubscriptions, churnRate] = await Promise.all([
    calculateMrr(db, accountId, environment),
    countActiveSubscriptions(db, accountId, environment),
    calculateChurnRate(db, accountId, environment, periodDays),
  ])

  return {
    mrr,
    active_subscriptions: activeSubscriptions,
    churn_rate: churnRate,
    churn_period_days: periodDays,
  }
}
