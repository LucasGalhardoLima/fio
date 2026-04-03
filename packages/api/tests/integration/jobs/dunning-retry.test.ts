import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '../../../src/db/types.js'
import {
  createTestDatabase,
  createTestApp,
  createTestAccount,
  createTestApiKey,
  createTestCustomer,
  cleanupDatabase,
} from '../../helpers/setup.js'
import { transitionSubscription } from '../../../src/domain/subscription-state-machine.js'
import { findSubscriptionById, insertSubscription } from '../../../src/db/queries/subscriptions.js'
import { insertInvoice } from '../../../src/db/queries/invoices.js'
import { createCharge } from '../../../src/services/charge-service.js'
import { MockPaymentProvider } from '../../../src/providers/mock-provider.js'
import { SUBSCRIPTION_STATUS, CANCELLATION_REASON, INVOICE_STATUS } from '@fio-pay/shared'

describe('Dunning Retry — business logic', () => {
  let db: Kysely<Database>
  let app: Awaited<ReturnType<typeof createTestApp>>
  let accountId: string
  let customerId: string
  let planId: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
    const { rawKey } = await createTestApiKey(db, account.id)
    const customer = await createTestCustomer(db, account.id, 'test')
    customerId = customer.id

    // Create plan with default dunning schedule
    const plan = await db
      .insertInto('plans')
      .values({
        account_id: accountId,
        environment: 'test',
        name: 'Dunning Test Plan',
        amount: 2990,
        interval: 'month',
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    planId = plan.id
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  function createSubscriptionValues(overrides?: Record<string, unknown>) {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    return {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      plan_id: planId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      current_period_start: now,
      current_period_end: periodEnd,
      trial_end: null,
      canceled_at: null,
      cancellation_reason: null,
      paused_at: null,
      ...overrides,
    }
  }

  it('subscription with exhausted retries is canceled', async () => {
    // Create a subscription in past_due status
    const sub = await insertSubscription(
      db,
      createSubscriptionValues({ status: SUBSCRIPTION_STATUS.PAST_DUE }),
    )
    expect(sub.status).toBe(SUBSCRIPTION_STATUS.PAST_DUE)

    // Transition to canceled with dunning_failed reason (what the worker does
    // when retry_index >= schedule.length)
    const canceled = await transitionSubscription(
      db,
      sub.id,
      SUBSCRIPTION_STATUS.CANCELED,
      {
        canceled_at: new Date(),
        cancellation_reason: CANCELLATION_REASON.DUNNING_FAILED,
      },
    )

    expect(canceled.status).toBe(SUBSCRIPTION_STATUS.CANCELED)
    expect(canceled.cancellation_reason).toBe(CANCELLATION_REASON.DUNNING_FAILED)
    expect(canceled.canceled_at).not.toBeNull()
  })

  it('past_due subscription with default dunning_schedule has 3 retry attempts', async () => {
    const plan = await db
      .selectFrom('plans')
      .selectAll()
      .where('id', '=', planId)
      .executeTakeFirstOrThrow()

    // Default dunning_schedule is [1, 3, 7]
    expect(plan.dunning_schedule).toEqual([1, 3, 7])
    expect(plan.dunning_schedule.length).toBe(3)
  })

  it('retry_index 0 means first retry (not exhausted)', () => {
    const schedule = [1, 3, 7]

    // Indices 0, 1, 2 are within bounds — retries remain
    expect(0 < schedule.length).toBe(true)
    expect(1 < schedule.length).toBe(true)
    expect(2 < schedule.length).toBe(true)

    // Index 3 is out of bounds — all retries exhausted
    expect(3 < schedule.length).toBe(false)
  })

  it('subscription can transition from active to past_due', async () => {
    const sub = await insertSubscription(
      db,
      createSubscriptionValues({ status: SUBSCRIPTION_STATUS.ACTIVE }),
    )
    expect(sub.status).toBe(SUBSCRIPTION_STATUS.ACTIVE)

    const pastDue = await transitionSubscription(
      db,
      sub.id,
      SUBSCRIPTION_STATUS.PAST_DUE,
    )

    expect(pastDue.status).toBe(SUBSCRIPTION_STATUS.PAST_DUE)
    expect(pastDue.id).toBe(sub.id)
  })

  it('past_due subscription transitions to canceled after dunning exhaustion', async () => {
    // Create active subscription, then transition to past_due, then to canceled
    const sub = await insertSubscription(
      db,
      createSubscriptionValues({ status: SUBSCRIPTION_STATUS.ACTIVE }),
    )

    const pastDue = await transitionSubscription(
      db,
      sub.id,
      SUBSCRIPTION_STATUS.PAST_DUE,
    )
    expect(pastDue.status).toBe(SUBSCRIPTION_STATUS.PAST_DUE)

    const canceled = await transitionSubscription(
      db,
      sub.id,
      SUBSCRIPTION_STATUS.CANCELED,
      {
        canceled_at: new Date(),
        cancellation_reason: CANCELLATION_REASON.DUNNING_FAILED,
      },
    )

    expect(canceled.status).toBe(SUBSCRIPTION_STATUS.CANCELED)
    expect(canceled.cancellation_reason).toBe(CANCELLATION_REASON.DUNNING_FAILED)
    expect(canceled.canceled_at).not.toBeNull()

    // Verify via direct DB query
    const found = await findSubscriptionById(db, sub.id, accountId, 'test')
    expect(found).toBeDefined()
    expect(found!.status).toBe(SUBSCRIPTION_STATUS.CANCELED)
    expect(found!.cancellation_reason).toBe(CANCELLATION_REASON.DUNNING_FAILED)
  })

  it('creating retry charge for failed invoice', async () => {
    const provider = new MockPaymentProvider()

    // Create a past_due subscription
    const sub = await insertSubscription(
      db,
      createSubscriptionValues({ status: SUBSCRIPTION_STATUS.PAST_DUE }),
    )

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + 7)

    // Create an open invoice for the subscription
    const invoice = await insertInvoice(db, {
      account_id: accountId,
      environment: 'test',
      subscription_id: sub.id,
      customer_id: customerId,
      charge_id: null,
      amount: 2990,
      status: INVOICE_STATUS.OPEN,
      period_start: now,
      period_end: periodEnd,
      due_date: dueDate,
      paid_at: null,
    })
    expect(invoice.amount).toBe(2990)

    // Create a new charge for the invoice amount (what the dunning worker does)
    const charge = await createCharge(db, provider, {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      amount: invoice.amount,
      expires_in: 3600,
      pix_key: 'test-pix-key',
      invoice_id: invoice.id,
    })

    expect(charge.amount).toBe(2990)
    expect(charge.invoice_id).toBe(invoice.id)
    expect(charge.customer_id).toBe(customerId)
    expect(charge.status).toBe('pending')

    // Link the charge to the invoice (what the dunning worker does)
    await db
      .updateTable('invoices')
      .set({ charge_id: charge.id })
      .where('id', '=', invoice.id)
      .execute()

    // Verify the invoice now references the new charge
    const updatedInvoice = await db
      .selectFrom('invoices')
      .selectAll()
      .where('id', '=', invoice.id)
      .executeTakeFirstOrThrow()

    expect(updatedInvoice.charge_id).toBe(charge.id)
  })
})
