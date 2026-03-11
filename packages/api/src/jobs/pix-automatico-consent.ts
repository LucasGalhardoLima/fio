import PgBoss from 'pg-boss'
import { QUEUE_NAMES } from './queue-setup.js'
import { getDatabase } from '../db/connection.js'
import { findCustomerById, updateCustomer } from '../db/queries/customers.js'
import { findSubscriptionById } from '../db/queries/subscriptions.js'
import { createEvent } from '../services/event-service.js'
import {
  EVENT_TYPES,
  ENTITY_TYPES,
  PIX_AUTOMATICO_CONSENT_STATUS,
} from '@fio-pay/shared'
import type { PaymentProvider } from '../providers/payment-provider.js'

interface PixAutomaticoConsentJobData {
  customer_id: string
  subscription_id: string
  consent_id: string
  account_id: string
  environment: string
}

interface PixAutomaticoConsentOptions {
  provider: PaymentProvider
}

/**
 * Handle consent status transitions (approved, denied, canceled).
 */
async function handleConsentResolution(
  status: string,
  data: PixAutomaticoConsentJobData,
): Promise<{ status: string; consent_id: string }> {
  const db = getDatabase()

  await updateCustomer(
    db,
    data.customer_id,
    data.account_id,
    data.environment,
    { pix_automatico_consent_status: status },
  )

  if (status === PIX_AUTOMATICO_CONSENT_STATUS.AUTHORIZED) {
    await db
      .updateTable('subscriptions')
      .set({ pix_automatico: true, updated_at: new Date() })
      .where('id', '=', data.subscription_id)
      .execute()

    await createEvent(db, {
      account_id: data.account_id,
      environment: data.environment,
      event_type: EVENT_TYPES.PIX_AUTOMATICO_CONSENT_APPROVED,
      entity_type: ENTITY_TYPES.CUSTOMER,
      entity_id: data.customer_id,
      data: {
        customer_id: data.customer_id,
        subscription_id: data.subscription_id,
        consent_id: data.consent_id,
        status,
      },
    })

    return { status: 'approved', consent_id: data.consent_id }
  }

  const eventType = status === PIX_AUTOMATICO_CONSENT_STATUS.DENIED
    ? EVENT_TYPES.PIX_AUTOMATICO_CONSENT_DENIED
    : EVENT_TYPES.PIX_AUTOMATICO_CONSENT_CANCELED

  await createEvent(db, {
    account_id: data.account_id,
    environment: data.environment,
    event_type: eventType,
    entity_type: ENTITY_TYPES.CUSTOMER,
    entity_id: data.customer_id,
    data: {
      customer_id: data.customer_id,
      subscription_id: data.subscription_id,
      consent_id: data.consent_id,
      status,
    },
  })

  return { status, consent_id: data.consent_id }
}

/**
 * Register the Pix Automatico consent polling worker with pg-boss.
 *
 * Responsibilities:
 * 1. Poll the consent status from the PaymentProvider
 * 2. Update customer.pix_automatico_consent_status
 * 3. Emit pix_automatico.consent_approved or pix_automatico.consent_denied events
 * 4. If approved, mark the subscription for automatic debit
 * 5. If still pending, re-enqueue with 30s delay
 */
export async function registerPixAutomaticoConsentWorker(
  boss: PgBoss,
  opts: PixAutomaticoConsentOptions,
): Promise<void> {
  const { provider } = opts

  await boss.work<PixAutomaticoConsentJobData>(
    QUEUE_NAMES.PIX_AUTOMATICO_CONSENT,
    async (jobs) => {
      const job = jobs[0]
      if (!job) return
      const data = job.data
      const db = getDatabase()

      if (!provider.getConsentStatus) {
        throw new Error('Payment provider does not support Pix Automatico consent polling')
      }

      const customer = await findCustomerById(
        db, data.customer_id, data.account_id, data.environment,
      )
      if (!customer) {
        throw new Error(`Customer not found: ${data.customer_id}`)
      }

      const subscription = await findSubscriptionById(
        db, data.subscription_id, data.account_id, data.environment,
      )
      if (!subscription) {
        throw new Error(`Subscription not found: ${data.subscription_id}`)
      }

      const consentStatus = await provider.getConsentStatus(data.consent_id)

      if (consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.PENDING) {
        // Re-enqueue with 30s delay to poll again
        await boss.send(
          QUEUE_NAMES.PIX_AUTOMATICO_CONSENT,
          data,
          { startAfter: 30 },
        )
        return { status: 'still_pending', consent_id: data.consent_id }
      }

      if (
        consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.AUTHORIZED ||
        consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.DENIED ||
        consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.CANCELED
      ) {
        return handleConsentResolution(consentStatus.status, data)
      }

      return { status: consentStatus.status, consent_id: data.consent_id }
    },
  )
}
