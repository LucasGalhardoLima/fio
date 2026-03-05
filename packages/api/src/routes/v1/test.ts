import type { FastifyInstance } from 'fastify'
import { idParamSchema, advanceTimeSchema, CHARGE_STATUS, INVOICE_STATUS, EVENT_TYPES, ENTITY_TYPES } from '@fio-pay/shared'
import { getDatabase } from '../../db/connection.js'
import { authMiddleware } from '../../middleware/auth.js'
import { findChargeById } from '../../db/queries/charges.js'
import { findInvoiceById } from '../../db/queries/invoices.js'
import {
  findSubscriptionsDueForBilling,
  findTrialExpirations,
} from '../../db/queries/subscriptions.js'
import { findPlanById } from '../../db/queries/plans.js'
import { insertInvoice } from '../../db/queries/invoices.js'
import { transitionCharge } from '../../domain/charge-state-machine.js'
import { transitionInvoice } from '../../domain/invoice-state-machine.js'
import { transitionSubscription } from '../../domain/subscription-state-machine.js'
import { createEvent } from '../../services/event-service.js'
import { FioError } from '../../lib/errors.js'

class ForbiddenError extends FioError {
  constructor(message: string) {
    super({
      type: 'forbidden',
      message,
      code: 'forbidden',
      statusCode: 403,
    })
    this.name = 'ForbiddenError'
  }
}

function assertTestEnvironment(environment: string): void {
  if (environment !== 'test') {
    throw new ForbiddenError(
      'Sandbox simulation endpoints are only available in the test environment',
    )
  }
}

export async function testRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('preHandler', authMiddleware)

  /**
   * POST /v1/test/charges/:id/pay
   *
   * Simulate payment for a pending charge. Triggers the full event chain:
   * - charge -> paid
   * - If linked to an invoice: invoice -> paid
   */
  fastify.route({
    method: 'POST',
    url: '/v1/test/charges/:id/pay',
    schema: {
      params: idParamSchema,
    },
    handler: async (request, reply) => {
      assertTestEnvironment(request.environment)

      const db = getDatabase()
      const params = request.params as { id: string }

      const charge = await findChargeById(
        db, params.id, request.accountId, request.environment,
      )

      if (!charge) {
        throw new FioError({
          type: 'not_found',
          message: `Charge not found: ${params.id}`,
          code: 'not_found',
          statusCode: 404,
        })
      }

      // Transition charge to paid via state machine
      const paidCharge = await transitionCharge(
        db, charge.id, CHARGE_STATUS.PAID, {
          pix_end_to_end_id: `E_SANDBOX_${Date.now()}`,
          paid_at: new Date(),
        },
      )

      // If the charge is linked to an invoice, transition the invoice to paid
      if (paidCharge.invoice_id) {
        const invoice = await findInvoiceById(
          db, paidCharge.invoice_id, request.accountId, request.environment,
        )

        if (invoice && invoice.status === 'open') {
          await transitionInvoice(db, invoice.id, INVOICE_STATUS.PAID, {
            paid_at: new Date(),
          })
        }
      }

      return reply.send(paidCharge)
    },
  })

  /**
   * POST /v1/test/time/advance
   *
   * Advance sandbox time by N days. This triggers billing cycles
   * and dunning at accelerated pace by finding subscriptions that
   * would be due within the simulated time window and processing them.
   */
  fastify.route({
    method: 'POST',
    url: '/v1/test/time/advance',
    schema: {
      body: advanceTimeSchema,
    },
    handler: async (request, reply) => {
      assertTestEnvironment(request.environment)

      const db = getDatabase()
      const body = request.body as { days: number }

      let billingProcessed = 0
      let trialsProcessed = 0

      // Simulate advancing time by updating subscription period dates
      // to trigger billing cycles and trial expirations
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + body.days)

      // Move subscription periods backward to simulate time advancement
      // This makes them appear as if their billing date has passed
      await db
        .updateTable('subscriptions')
        .set({
          current_period_end: new Date(
            Date.now() - body.days * 24 * 60 * 60 * 1000,
          ),
          updated_at: new Date(),
        })
        .where('account_id', '=', request.accountId)
        .where('environment', '=', request.environment)
        .where('status', 'in', ['active', 'trialing'])
        .execute()

      // Process billing cycles that are now due
      const dueSubs = await findSubscriptionsDueForBilling(db)
      for (const sub of dueSubs) {
        if (sub.account_id !== request.accountId) continue

        try {
          const plan = await findPlanById(
            db, sub.plan_id, sub.account_id, sub.environment,
          )
          if (!plan) continue

          const newPeriodEnd = new Date(futureDate)
          switch (plan.interval) {
            case 'week':
              newPeriodEnd.setDate(newPeriodEnd.getDate() + 7)
              break
            case 'month':
              newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
              break
            case 'year':
              newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1)
              break
          }

          // Create invoice for the new period
          const invoice = await insertInvoice(db, {
            account_id: sub.account_id,
            environment: sub.environment,
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            charge_id: null,
            amount: plan.amount,
            status: 'draft',
            period_start: futureDate,
            period_end: newPeriodEnd,
            due_date: futureDate,
            paid_at: null,
          })

          await transitionInvoice(db, invoice.id, INVOICE_STATUS.OPEN)

          // Advance subscription period
          await db
            .updateTable('subscriptions')
            .set({
              current_period_start: futureDate,
              current_period_end: newPeriodEnd,
              updated_at: new Date(),
            })
            .where('id', '=', sub.id)
            .execute()

          billingProcessed += 1
        } catch {
          // Continue processing other subscriptions on error
        }
      }

      // Process trial expirations
      const expiredTrials = await findTrialExpirations(db)
      for (const sub of expiredTrials) {
        if (sub.account_id !== request.accountId) continue

        try {
          await transitionSubscription(db, sub.id, 'active', {
            current_period_start: new Date(),
            current_period_end: futureDate,
            trial_end: null,
          })

          await createEvent(db, {
            account_id: sub.account_id,
            environment: sub.environment,
            event_type: EVENT_TYPES.SUBSCRIPTION_ACTIVATED,
            entity_type: ENTITY_TYPES.SUBSCRIPTION,
            entity_id: sub.id,
            data: {
              subscription_id: sub.id,
              status: 'active',
              previous_status: 'trialing',
            },
          })

          trialsProcessed += 1
        } catch {
          // Continue processing other subscriptions on error
        }
      }

      return reply.send({
        days_advanced: body.days,
        billing_cycles_processed: billingProcessed,
        trials_processed: trialsProcessed,
      })
    },
  })
}
