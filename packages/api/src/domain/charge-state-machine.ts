import type { Kysely } from 'kysely'
import type { ChargeStatus } from '@fio-pay/shared'
import { CHARGE_STATUS, EVENT_TYPES, ENTITY_TYPES } from '@fio-pay/shared'
import type { Database, ChargeRow } from '../db/types.js'
import { StateTransitionError } from '../lib/errors.js'
import { createEvent } from '../services/event-service.js'

/**
 * Valid state transitions for charges.
 * Each key maps to the list of states it can transition to.
 */
export const CHARGE_TRANSITIONS: Record<ChargeStatus, ChargeStatus[]> = {
  [CHARGE_STATUS.PENDING]: [
    CHARGE_STATUS.PAID,
    CHARGE_STATUS.FAILED,
    CHARGE_STATUS.EXPIRED,
  ],
  [CHARGE_STATUS.PAID]: [
    CHARGE_STATUS.REFUNDED,
    CHARGE_STATUS.PARTIALLY_REFUNDED,
  ],
  [CHARGE_STATUS.FAILED]: [],
  [CHARGE_STATUS.EXPIRED]: [],
  [CHARGE_STATUS.REFUNDED]: [],
  [CHARGE_STATUS.PARTIALLY_REFUNDED]: [
    CHARGE_STATUS.REFUNDED,
    CHARGE_STATUS.PARTIALLY_REFUNDED,
  ],
}

/**
 * Map from charge status to the event type emitted on transition.
 */
const STATUS_TO_EVENT: Record<ChargeStatus, string> = {
  [CHARGE_STATUS.PENDING]: EVENT_TYPES.CHARGE_CREATED,
  [CHARGE_STATUS.PAID]: EVENT_TYPES.CHARGE_PAID,
  [CHARGE_STATUS.FAILED]: EVENT_TYPES.CHARGE_FAILED,
  [CHARGE_STATUS.EXPIRED]: EVENT_TYPES.CHARGE_EXPIRED,
  [CHARGE_STATUS.REFUNDED]: EVENT_TYPES.CHARGE_REFUNDED,
  [CHARGE_STATUS.PARTIALLY_REFUNDED]: EVENT_TYPES.CHARGE_PARTIALLY_REFUNDED,
}

/**
 * Validate that a transition from `from` to `to` is allowed.
 * Throws StateTransitionError if the transition is invalid.
 */
export function validateChargeTransition(from: ChargeStatus, to: ChargeStatus): void {
  const allowed = CHARGE_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new StateTransitionError(
      `Invalid charge transition from '${from}' to '${to}'`,
    )
  }
}

/**
 * Transition a charge to a new status.
 *
 * 1. Validates the transition is allowed
 * 2. Updates the status in the database
 * 3. Emits the corresponding event
 * 4. Returns the updated charge row
 */
export async function transitionCharge(
  db: Kysely<Database>,
  chargeId: string,
  to: ChargeStatus,
  updates?: Partial<{
    pix_end_to_end_id: string
    paid_at: Date
    refunded_amount: number
  }>,
): Promise<ChargeRow> {
  // Fetch the current charge
  const current = await db
    .selectFrom('charges')
    .selectAll()
    .where('id', '=', chargeId)
    .executeTakeFirst()

  if (!current) {
    throw new StateTransitionError(`Charge not found: ${chargeId}`)
  }

  const from = current.status as ChargeStatus
  validateChargeTransition(from, to)

  // Build the update set
  const updateValues: Record<string, unknown> = {
    status: to,
    ...updates,
  }

  const updated = await db
    .updateTable('charges')
    .set(updateValues)
    .where('id', '=', chargeId)
    .returningAll()
    .executeTakeFirstOrThrow()

  // Emit event for the state change
  const eventType = STATUS_TO_EVENT[to]
  if (eventType) {
    await createEvent(db, {
      account_id: updated.account_id,
      environment: updated.environment,
      event_type: eventType,
      entity_type: ENTITY_TYPES.CHARGE,
      entity_id: updated.id,
      data: {
        charge_id: updated.id,
        status: to,
        previous_status: from,
        amount: updated.amount,
      },
    })
  }

  return updated
}
