import type { Kysely } from 'kysely'
import { INVOICE_STATUS } from '@fio-pay/shared'
import type { Database, InvoiceRow } from '../db/types.js'
import { insertInvoice, findInvoiceById } from '../db/queries/invoices.js'
import { transitionInvoice } from '../domain/invoice-state-machine.js'
import { NotFoundError } from '../lib/errors.js'

interface CreateInvoiceParams {
  account_id: string
  environment: string
  subscription_id: string
  customer_id: string
  amount: number // centavos
  period_start: Date
  period_end: Date
  due_date: Date
}

/**
 * Create an invoice with draft status and immediately transition to open.
 */
export async function createInvoice(
  db: Kysely<Database>,
  params: CreateInvoiceParams,
): Promise<InvoiceRow> {
  const invoice = await insertInvoice(db, {
    account_id: params.account_id,
    environment: params.environment,
    subscription_id: params.subscription_id,
    customer_id: params.customer_id,
    charge_id: null,
    amount: params.amount,
    status: INVOICE_STATUS.DRAFT,
    period_start: params.period_start,
    period_end: params.period_end,
    due_date: params.due_date,
    paid_at: null,
  })

  // Transition from draft -> open via state machine
  const openInvoice = await transitionInvoice(
    db, invoice.id, INVOICE_STATUS.OPEN,
  )

  return openInvoice
}

/**
 * Get an invoice by ID. Throws NotFoundError if not found.
 */
export async function getInvoice(
  db: Kysely<Database>,
  id: string,
  accountId: string,
  environment: string,
): Promise<InvoiceRow> {
  const invoice = await findInvoiceById(db, id, accountId, environment)
  if (!invoice) {
    throw new NotFoundError(`Invoice not found: ${id}`)
  }
  return invoice
}

/**
 * Update an invoice when a payment succeeds.
 * Transitions from open -> paid and sets paid_at.
 */
export async function updateInvoiceOnPayment(
  db: Kysely<Database>,
  invoiceId: string,
  accountId: string,
  environment: string,
): Promise<InvoiceRow> {
  const invoice = await findInvoiceById(db, invoiceId, accountId, environment)
  if (!invoice) {
    throw new NotFoundError(`Invoice not found: ${invoiceId}`)
  }

  return transitionInvoice(db, invoiceId, INVOICE_STATUS.PAID, {
    paid_at: new Date(),
  })
}

/**
 * Update an invoice when a payment fails.
 * Transitions from open -> failed.
 */
export async function updateInvoiceOnFailure(
  db: Kysely<Database>,
  invoiceId: string,
  accountId: string,
  environment: string,
): Promise<InvoiceRow> {
  const invoice = await findInvoiceById(db, invoiceId, accountId, environment)
  if (!invoice) {
    throw new NotFoundError(`Invoice not found: ${invoiceId}`)
  }

  return transitionInvoice(db, invoiceId, INVOICE_STATUS.FAILED)
}
