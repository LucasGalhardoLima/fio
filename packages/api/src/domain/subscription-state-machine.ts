import type { Kysely } from 'kysely'
import type { SubscriptionStatus } from '@fio-pay/shared'
import {
  SUBSCRIPTION_STATUS,
  EVENT_TYPES,
  ENTITY_TYPES,
} from '@fio-pay/shared'
import type { Database, SubscriptionRow } from '../db/types.js'
import { StateTransitionError } from '../lib/errors.js'
import { createEvent } from '../services/event-service.js'

/**
 * Valid state transitions for subscriptions.
 * Each key maps to the list of states it can transition to.
 */
export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SUBSCRIPTION_STATUS.TRIALING]: [
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.CANCELED,
  ],
  [SUBSCRIPTION_STATUS.ACTIVE]: [
    SUBSCRIPTION_STATUS.PAST_DUE,
    SUBSCRIPTION_STATUS.CANCELED,
    SUBSCRIPTION_STATUS.PAUSED,
  ],
  [SUBSCRIPTION_STATUS.PAST_DUE]: [
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.CANCELED,
  ],
  [SUBSCRIPTION_STATUS.PAUSED]: [
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.CANCELED,
  ],
  [SUBSCRIPTION_STATUS.CANCELED]: [],
}

/**
 * Map from subscription status to the event type emitted on transition.
 */
const STATUS_TO_EVENT: Record<SubscriptionStatus, string> = {
  [SUBSCRIPTION_STATUS.TRIALING]: EVENT_TYPES.SUBSCRIPTION_CREATED,
  [SUBSCRIPTION_STATUS.ACTIVE]: EVENT_TYPES.SUBSCRIPTION_ACTIVATED,
  [SUBSCRIPTION_STATUS.PAST_DUE]: EVENT_TYPES.SUBSCRIPTION_PAST_DUE,
  [SUBSCRIPTION_STATUS.CANCELED]: EVENT_TYPES.SUBSCRIPTION_CANCELED,
  [SUBSCRIPTION_STATUS.PAUSED]: EVENT_TYPES.SUBSCRIPTION_PAUSED,
}

/**
 * Validate that a transition from `from` to `to` is allowed.
 * Throws StateTransitionError if the transition is invalid.
 */
export function validateSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  const allowed = SUBSCRIPTION_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new StateTransitionError(
      `Invalid subscription transition from '${from}' to '${to}'`,
    )
  }
}

/**
 * Transition a subscription to a new status.
 *
 * 1. Validates the transition is allowed
 * 2. Updates the status in the database
 * 3. Emits the corresponding event
 * 4. Returns the updated subscription row
 */
export async function transitionSubscription(
  db: Kysely<Database>,
  subscriptionId: string,
  to: SubscriptionStatus,
  updates?: Partial<{
    canceled_at: Date
    cancellation_reason: string
    paused_at: Date | null
    cancel_at_period_end: boolean
    current_period_start: Date
    current_period_end: Date
    trial_end: Date | null
  }>,
): Promise<SubscriptionRow> {
  const current = await db
    .selectFrom('subscriptions')
    .selectAll()
    .where('id', '=', subscriptionId)
    .executeTakeFirst()

  if (!current) {
    throw new StateTransitionError(`Subscription not found: ${subscriptionId}`)
  }

  const from = current.status as SubscriptionStatus
  validateSubscriptionTransition(from, to)

  const updateValues: Record<string, unknown> = {
    status: to,
    updated_at: new Date(),
    ...updates,
  }

  const updated = await db
    .updateTable('subscriptions')
    .set(updateValues)
    .where('id', '=', subscriptionId)
    .returningAll()
    .executeTakeFirstOrThrow()

  const eventType = STATUS_TO_EVENT[to]
  if (eventType) {
    await createEvent(db, {
      account_id: updated.account_id,
      environment: updated.environment,
      event_type: eventType,
      entity_type: ENTITY_TYPES.SUBSCRIPTION,
      entity_id: updated.id,
      data: {
        subscription_id: updated.id,
        status: to,
        previous_status: from,
        customer_id: updated.customer_id,
        plan_id: updated.plan_id,
      },
    })
  }

  return updated
}
