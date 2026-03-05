import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDatabase } from '../../db/connection.js'
import { handlePaymentCallback } from '../../services/charge-service.js'

/**
 * Schema for the Efi PIX notification payload.
 * Efi sends an array of pix payment notifications in a single request.
 */
const efiPixNotificationSchema = z.object({
  pix: z.array(
    z.object({
      endToEndId: z.string(),
      txid: z.string(),
      valor: z.string(),
      horario: z.string(),
    }),
  ),
})

type EfiPixNotification = z.infer<typeof efiPixNotificationSchema>

const EFI_PROVIDER = 'efi'

/**
 * Efi Pay webhook receiver.
 *
 * No API key auth — Efi authenticates via mTLS (the TLS client certificate
 * is validated by the reverse proxy / load balancer in front of the API).
 *
 * The route receives PIX payment notifications and transitions matched
 * charges to paid. Individual charge failures are logged but don't fail
 * the entire batch (Efi expects 200 OK).
 */
export async function efiCallbackRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /webhooks/efi
  fastify.route({
    method: 'POST',
    url: '/webhooks/efi',
    schema: {
      body: efiPixNotificationSchema,
    },
    handler: async (request, reply) => {
      const body = request.body as EfiPixNotification
      const db = getDatabase()

      for (const pixPayment of body.pix) {
        try {
          const paidAt = new Date(pixPayment.horario)

          await handlePaymentCallback(
            db,
            EFI_PROVIDER,
            pixPayment.txid,
            pixPayment.endToEndId,
            paidAt,
          )
        } catch (err: unknown) {
          // Log but don't fail the batch — Efi expects 200 for the whole request
          const message = err instanceof Error ? err.message : 'Unknown error'
          fastify.log.error(
            { txid: pixPayment.txid, error: message },
            'Failed to process Efi PIX notification',
          )
        }
      }

      return reply.status(200).send({ status: 'ok' })
    },
  })

  // Efi also sends a confirmation request to verify the webhook URL.
  // It expects a 200 response to any request on the /pix path.
  fastify.route({
    method: 'POST',
    url: '/webhooks/efi/pix',
    schema: {
      body: efiPixNotificationSchema,
    },
    handler: async (request, reply) => {
      const body = request.body as EfiPixNotification
      const db = getDatabase()

      for (const pixPayment of body.pix) {
        try {
          const paidAt = new Date(pixPayment.horario)

          await handlePaymentCallback(
            db,
            EFI_PROVIDER,
            pixPayment.txid,
            pixPayment.endToEndId,
            paidAt,
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          fastify.log.error(
            { txid: pixPayment.txid, error: message },
            'Failed to process Efi PIX notification',
          )
        }
      }

      return reply.status(200).send({ status: 'ok' })
    },
  })
}
