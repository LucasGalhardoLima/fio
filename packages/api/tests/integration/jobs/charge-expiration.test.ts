import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
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
import {
  findExpiredPendingCharges,
  insertCharge,
} from '../../../src/db/queries/charges.js'
import { transitionCharge } from '../../../src/domain/charge-state-machine.js'
import { CHARGE_STATUS } from '@fio-pay/shared'

describe('Charge Expiration — business logic', () => {
  let app: FastifyInstance
  let db: Kysely<Database>
  let accountId: string
  let customerId: string
  let apiKey: string

  beforeAll(async () => {
    db = createTestDatabase()
    app = await createTestApp(db)
    await cleanupDatabase(db)

    const account = await createTestAccount(db)
    accountId = account.id
    const { rawKey } = await createTestApiKey(db, account.id)
    apiKey = rawKey
    const customer = await createTestCustomer(db, account.id, 'test')
    customerId = customer.id
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  // -------------------------------------------------------------------------
  // findExpiredPendingCharges
  // -------------------------------------------------------------------------

  it('findExpiredPendingCharges returns pending charges with past expires_at', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)

    const charge = await insertCharge(db, {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      invoice_id: null,
      amount: 5000,
      status: CHARGE_STATUS.PENDING,
      pix_qr_code: null,
      pix_qr_code_image: null,
      pix_copy_paste: null,
      pix_end_to_end_id: null,
      provider_reference: null,
      idempotency_key: null,
      expires_at: pastDate,
      paid_at: null,
    })

    const expired = await findExpiredPendingCharges(db)
    const ids = expired.map((c) => c.id)

    expect(ids).toContain(charge.id)
  })

  it('findExpiredPendingCharges skips paid charges', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)

    const charge = await insertCharge(db, {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      invoice_id: null,
      amount: 3000,
      status: CHARGE_STATUS.PAID,
      pix_qr_code: null,
      pix_qr_code_image: null,
      pix_copy_paste: null,
      pix_end_to_end_id: null,
      provider_reference: null,
      idempotency_key: null,
      expires_at: pastDate,
      paid_at: pastDate,
    })

    const expired = await findExpiredPendingCharges(db)
    const ids = expired.map((c) => c.id)

    expect(ids).not.toContain(charge.id)
  })

  it('findExpiredPendingCharges skips charges with future expires_at', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)

    const charge = await insertCharge(db, {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      invoice_id: null,
      amount: 2000,
      status: CHARGE_STATUS.PENDING,
      pix_qr_code: null,
      pix_qr_code_image: null,
      pix_copy_paste: null,
      pix_end_to_end_id: null,
      provider_reference: null,
      idempotency_key: null,
      expires_at: futureDate,
      paid_at: null,
    })

    const expired = await findExpiredPendingCharges(db)
    const ids = expired.map((c) => c.id)

    expect(ids).not.toContain(charge.id)
  })

  // -------------------------------------------------------------------------
  // transitionCharge to expired
  // -------------------------------------------------------------------------

  it('expired charge can be transitioned to expired status', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)

    const charge = await insertCharge(db, {
      account_id: accountId,
      environment: 'test',
      customer_id: customerId,
      invoice_id: null,
      amount: 7500,
      status: CHARGE_STATUS.PENDING,
      pix_qr_code: null,
      pix_qr_code_image: null,
      pix_copy_paste: null,
      pix_end_to_end_id: null,
      provider_reference: null,
      idempotency_key: null,
      expires_at: pastDate,
      paid_at: null,
    })

    const updated = await transitionCharge(db, charge.id, CHARGE_STATUS.EXPIRED)

    expect(updated.status).toBe(CHARGE_STATUS.EXPIRED)
    expect(updated.id).toBe(charge.id)
  })

  // -------------------------------------------------------------------------
  // Paid charges are not affected by expiration
  // -------------------------------------------------------------------------

  it('already-paid charge is not affected by expiration query', async () => {
    // Create a charge via the API route so it gets a valid pending state
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/charges',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { customer_id: customerId, amount: 4200 },
    })
    expect(createRes.statusCode).toBe(201)

    const { id: chargeId } = createRes.json<{ id: string }>()

    // Pay it via the test route
    const payRes = await app.inject({
      method: 'POST',
      url: `/v1/test/charges/${chargeId}/pay`,
      headers: { authorization: `Bearer ${apiKey}` },
    })
    expect(payRes.statusCode).toBe(200)

    // Manually backdate expires_at so it *would* match the expiration query
    // if the status were still 'pending'
    const pastDate = new Date(Date.now() - 60 * 60 * 1000)
    await db
      .updateTable('charges')
      .set({ expires_at: pastDate })
      .where('id', '=', chargeId)
      .execute()

    const expired = await findExpiredPendingCharges(db)
    const ids = expired.map((c) => c.id)

    expect(ids).not.toContain(chargeId)
  })
})
