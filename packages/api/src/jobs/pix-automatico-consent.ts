import { Worker } from 'bullmq'
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
 * Start the Pix Automatico consent polling worker.
 *
 * Responsibilities:
 * 1. Poll the consent status from the PaymentProvider
 * 2. Update customer.pix_automatico_consent_status
 * 3. Emit pix_automatico.consent_approved or pix_automatico.consent_denied events
 * 4. If approved, mark the subscription for automatic debit
 */
export function startPixAutomaticoConsentWorker(
  opts: PixAutomaticoConsentOptions,
): Worker<PixAutomaticoConsentJobData> {
  const { provider } = opts

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }

  const worker = new Worker<PixAutomaticoConsentJobData>(
    QUEUE_NAMES.PIX_AUTOMATICO_CONSENT,
    async (job) => {
      const data = job.data
      const db = getDatabase()

      // Verify provider supports consent status polling
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

      // Poll consent status from provider
      const consentStatus = await provider.getConsentStatus(data.consent_id)

      // If still pending, we will rely on BullMQ retry/repeat to poll again
      if (consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.PENDING) {
        return { status: 'still_pending', consent_id: data.consent_id }
      }

      // Update customer consent status
      await updateCustomer(
        db,
        data.customer_id,
        data.account_id,
        data.environment,
        {
          pix_automatico_consent_status: consentStatus.status,
        },
      )

      if (consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.AUTHORIZED) {
        // Consent approved — mark subscription for automatic debit
        await db
          .updateTable('subscriptions')
          .set({
            pix_automatico: true,
            updated_at: new Date(),
          })
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
            status: consentStatus.status,
          },
        })

        return { status: 'approved', consent_id: data.consent_id }
      }

      if (consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.DENIED) {
        await createEvent(db, {
          account_id: data.account_id,
          environment: data.environment,
          event_type: EVENT_TYPES.PIX_AUTOMATICO_CONSENT_DENIED,
          entity_type: ENTITY_TYPES.CUSTOMER,
          entity_id: data.customer_id,
          data: {
            customer_id: data.customer_id,
            subscription_id: data.subscription_id,
            consent_id: data.consent_id,
            status: consentStatus.status,
          },
        })

        return { status: 'denied', consent_id: data.consent_id }
      }

      if (consentStatus.status === PIX_AUTOMATICO_CONSENT_STATUS.CANCELED) {
        await createEvent(db, {
          account_id: data.account_id,
          environment: data.environment,
          event_type: EVENT_TYPES.PIX_AUTOMATICO_CONSENT_CANCELED,
          entity_type: ENTITY_TYPES.CUSTOMER,
          entity_id: data.customer_id,
          data: {
            customer_id: data.customer_id,
            subscription_id: data.subscription_id,
            consent_id: data.consent_id,
            status: consentStatus.status,
          },
        })

        return { status: 'canceled', consent_id: data.consent_id }
      }

      return { status: consentStatus.status, consent_id: data.consent_id }
    },
    { connection: { url: redisUrl, maxRetriesPerRequest: null } },
  )

  return worker
}
