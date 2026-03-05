import type { Kysely } from 'kysely'
import type { InvoiceStatus } from '@fio-pay/shared'
import {
  INVOICE_STATUS,
  EVENT_TYPES,
  ENTITY_TYPES,
} from '@fio-pay/shared'
import type { Database, InvoiceRow } from '../db/types.js'
import { StateTransitionError } from '../lib/errors.js'
import { createEvent } from '../services/event-service.js'

/**
 * Valid state transitions for invoices.
 * Each key maps to the list of states it can transition to.
 */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [INVOICE_STATUS.DRAFT]: [
    INVOICE_STATUS.OPEN,
  ],
  [INVOICE_STATUS.OPEN]: [
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.FAILED,
    INVOICE_STATUS.VOID,
  ],
  [INVOICE_STATUS.PAID]: [],
  [INVOICE_STATUS.FAILED]: [],
  [INVOICE_STATUS.VOID]: [],
}

/**
 * Map from invoice status to the event type emitted on transition.
 */
const STATUS_TO_EVENT: Record<InvoiceStatus, string> = {
  [INVOICE_STATUS.DRAFT]: EVENT_TYPES.INVOICE_CREATED,
  [INVOICE_STATUS.OPEN]: EVENT_TYPES.INVOICE_CREATED,
  [INVOICE_STATUS.PAID]: EVENT_TYPES.INVOICE_PAID,
  [INVOICE_STATUS.FAILED]: EVENT_TYPES.INVOICE_FAILED,
  [INVOICE_STATUS.VOID]: EVENT_TYPES.INVOICE_FAILED,
}

/**
 * Validate that a transition from `from` to `to` is allowed.
 * Throws StateTransitionError if the transition is invalid.
 */
export function validateInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  const allowed = INVOICE_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new StateTransitionError(
      `Invalid invoice transition from '${from}' to '${to}'`,
    )
  }
}

/**
 * Transition an invoice to a new status.
 *
 * 1. Validates the transition is allowed
 * 2. Updates the status in the database
 * 3. Emits the corresponding event
 * 4. Returns the updated invoice row
 */
export async function transitionInvoice(
  db: Kysely<Database>,
  invoiceId: string,
  to: InvoiceStatus,
  updates?: Partial<{
    paid_at: Date
    charge_id: string
  }>,
): Promise<InvoiceRow> {
  const current = await db
    .selectFrom('invoices')
    .selectAll()
    .where('id', '=', invoiceId)
    .executeTakeFirst()

  if (!current) {
    throw new StateTransitionError(`Invoice not found: ${invoiceId}`)
  }

  const from = current.status as InvoiceStatus
  validateInvoiceTransition(from, to)

  const updateValues: Record<string, unknown> = {
    status: to,
    ...updates,
  }

  const updated = await db
    .updateTable('invoices')
    .set(updateValues)
    .where('id', '=', invoiceId)
    .returningAll()
    .executeTakeFirstOrThrow()

  const eventType = STATUS_TO_EVENT[to]
  if (eventType) {
    await createEvent(db, {
      account_id: updated.account_id,
      environment: updated.environment,
      event_type: eventType,
      entity_type: ENTITY_TYPES.INVOICE,
      entity_id: updated.id,
      data: {
        invoice_id: updated.id,
        subscription_id: updated.subscription_id,
        status: to,
        previous_status: from,
        amount: updated.amount,
      },
    })
  }

  return updated
}
