import crypto from 'node:crypto'
import type { Kysely } from 'kysely'
import type { PaginatedResponse } from '@fio-pay/shared'
import { CHARGE_STATUS, EVENT_TYPES, ENTITY_TYPES } from '@fio-pay/shared'
import type { Database, ChargeRow } from '../db/types.js'
import type { PaymentProvider } from '../providers/payment-provider.js'
import {
  insertCharge,
  findChargeById,
  findChargeByProviderRef,
  listChargesWithCursor,
} from '../db/queries/charges.js'
import { transitionCharge } from '../domain/charge-state-machine.js'
import { createEvent } from './event-service.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { paginateResults, normalizePaginationLimit } from '../lib/pagination.js'

interface CreateChargeParams {
  account_id: string
  environment: string
  customer_id: string
  amount: number // centavos
  expires_in: number // seconds
  pix_key: string
  invoice_id?: string
  idempotency_key?: string
  metadata?: Record<string, unknown>
}

interface ChargeFilters {
  status?: string
  customer_id?: string
}

interface PaginationParams {
  limit?: number
  starting_after?: string
}

/**
 * Create a PIX charge via the payment provider, persist it, and emit an event.
 */
export async function createCharge(
  db: Kysely<Database>,
  provider: PaymentProvider,
  params: CreateChargeParams,
): Promise<ChargeRow> {
  const txid = generateTxid()

  const pixResult = await provider.createPixCharge({
    amount: params.amount,
    txid,
    expiresInSeconds: params.expires_in,
    pixKey: params.pix_key,
  })

  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + params.expires_in)

  const charge = await insertCharge(db, {
    account_id: params.account_id,
    environment: params.environment,
    customer_id: params.customer_id,
    invoice_id: params.invoice_id ?? null,
    amount: params.amount,
    status: CHARGE_STATUS.PENDING,
    pix_qr_code: pixResult.qrCode,
    pix_qr_code_image: pixResult.qrCodeImage,
    pix_copy_paste: pixResult.copyPaste,
    provider_reference: pixResult.providerRef,
    idempotency_key: params.idempotency_key ?? null,
    expires_at: expiresAt,
    paid_at: null,
    pix_end_to_end_id: null,
    metadata: params.metadata ?? {},
  })

  await createEvent(db, {
    account_id: charge.account_id,
    environment: charge.environment,
    event_type: EVENT_TYPES.CHARGE_CREATED,
    entity_type: ENTITY_TYPES.CHARGE,
    entity_id: charge.id,
    data: {
      charge_id: charge.id,
      customer_id: charge.customer_id,
      amount: charge.amount,
      status: charge.status,
    },
  })

  return charge
}

/**
 * Get a charge by ID. Throws NotFoundError if not found.
 */
export async function getCharge(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<ChargeRow> {
  const charge = await findChargeById(db, id, accountId, environment)
  if (!charge) {
    throw new NotFoundError(`Charge not found: ${id}`)
  }
  return charge
}

/**
 * List charges with cursor-based pagination and optional filters.
 */
export async function listCharges(
  db: Kysely<Database>,
  accountId: string,
  environment: string,
  pagination: PaginationParams,
  filters?: ChargeFilters,
): Promise<PaginatedResponse<ChargeRow>> {
  const limit = normalizePaginationLimit(pagination.limit)

  const rows = await listChargesWithCursor(
    db, accountId, environment, limit + 1, pagination.starting_after, filters,
  )

  return paginateResults(rows, limit)
}

/**
 * Handle a payment callback from the PSP.
 * Looks up the charge by provider reference, transitions it to paid,
 * stores the endToEndId, and emits a charge.paid event.
 */
export async function handlePaymentCallback(
  db: Kysely<Database>,
  provider: string,
  providerRef: string,
  endToEndId: string,
  paidAt: Date,
): Promise<ChargeRow> {
  const charge = await findChargeByProviderRef(db, provider, providerRef)
  if (!charge) {
    throw new NotFoundError(`Charge not found for provider ref: ${providerRef}`)
  }

  const updated = await transitionCharge(db, charge.id, CHARGE_STATUS.PAID, {
    pix_end_to_end_id: endToEndId,
    paid_at: paidAt,
  })

  return updated
}

/**
 * Refund a paid charge (full or partial).
 */
export async function refundCharge(
  db: Kysely<Database>,
  provider: PaymentProvider,
  id: string,
  accountId: string,
  environment: string,
  amount?: number,
): Promise<ChargeRow> {
  const charge = await findChargeById(db, id, accountId, environment)
  if (!charge) {
    throw new NotFoundError(`Charge not found: ${id}`)
  }

  if (charge.status !== CHARGE_STATUS.PAID && charge.status !== CHARGE_STATUS.PARTIALLY_REFUNDED) {
    throw new ValidationError(`Cannot refund charge with status: ${charge.status}. Must be paid or partially_refunded.`)
  }

  if (!charge.pix_end_to_end_id) {
    throw new ValidationError('Cannot refund: missing endToEndId from payment')
  }

  const remainingAmount = charge.amount - charge.refunded_amount
  const refundAmount = amount ?? remainingAmount

  if (refundAmount <= 0 || refundAmount > remainingAmount) {
    throw new ValidationError(
      `Invalid refund amount: ${refundAmount}. Remaining refundable: ${remainingAmount}`,
    )
  }

  await provider.refund(charge.pix_end_to_end_id, refundAmount)

  const isFullRefund = refundAmount === remainingAmount
  const newStatus = isFullRefund ? CHARGE_STATUS.REFUNDED : CHARGE_STATUS.PARTIALLY_REFUNDED

  const updated = await transitionCharge(db, charge.id, newStatus, {
    refunded_amount: charge.refunded_amount + refundAmount,
  })

  return updated
}

/**
 * Generate a txid for Efi: 26-35 alphanumeric characters.
 */
function generateTxid(): string {
  // 16 random bytes = 32 hex chars; trim to 32 which fits 26-35 range
  return crypto.randomBytes(16).toString('hex')
}
