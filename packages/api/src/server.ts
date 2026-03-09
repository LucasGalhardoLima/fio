import type { Worker } from 'bullmq'
import { buildApp } from './app.js'
import { closeDatabase } from './db/connection.js'
import {
  closeQueues,
  getBillingCycleQueue,
  getChargeExpirationQueue,
  getIdempotencyCleanupQueue,
  getApiKeyRevocationQueue,
} from './jobs/queue-setup.js'
import { startBillingCycleWorker } from './jobs/billing-cycle.js'
import { startDunningRetryWorker } from './jobs/dunning-retry.js'
import { startWebhookDeliveryWorker } from './jobs/webhook-delivery.js'
import { startChargeExpirationWorker } from './jobs/charge-expiration.js'
import { startIdempotencyCleanupWorker } from './jobs/idempotency-cleanup.js'
import { startPixAutomaticoConsentWorker } from './jobs/pix-automatico-consent.js'
import { startApiKeyRevocationWorker } from './jobs/api-key-revocation.js'
import { customerRoutes } from './routes/v1/customers.js'
import { chargeRoutes } from './routes/v1/charges.js'
import { planRoutes } from './routes/v1/plans.js'
import { subscriptionRoutes } from './routes/v1/subscriptions.js'
import { invoiceRoutes } from './routes/v1/invoices.js'
import { webhookEndpointRoutes } from './routes/v1/webhook-endpoints.js'
import { webhookDeliveryRoutes } from './routes/v1/webhook-deliveries.js'
import { metricsRoutes } from './routes/v1/metrics.js'
import { testRoutes } from './routes/v1/test.js'
import { efiCallbackRoutes } from './routes/webhooks/efi-callback.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { fioErrorHandler } from './lib/errors.js'
import { fioRateLimit } from './middleware/rate-limit.js'
import { fioLogger } from './middleware/logger.js'
import { registerOpenAPI } from './openapi.js'
import { MockPaymentProvider } from './providers/mock-provider.js'
import { EfiProvider } from './providers/efi-provider.js'
import type { PaymentProvider } from './providers/payment-provider.js'

function resolveProvider(): PaymentProvider {
  const useEfi = process.env['EFI_CLIENT_ID'] && process.env['EFI_CLIENT_SECRET']

  if (useEfi) {
    return new EfiProvider({
      clientId: process.env['EFI_CLIENT_ID'] as string,
      clientSecret: process.env['EFI_CLIENT_SECRET'] as string,
      pixKey: process.env['PIX_KEY'] ?? '',
      certificatePath: process.env['EFI_CERTIFICATE_PATH'] ?? './certs/efi.pem',
      sandbox: process.env['EFI_SANDBOX'] === 'true',
    })
  }

  return new MockPaymentProvider()
}

async function start(): Promise<void> {
  const app = buildApp()

  const provider = resolveProvider()
  const pixKey = process.env['PIX_KEY'] ?? ''

  // Register plugins
  await app.register(fioErrorHandler)
  await app.register(fioRateLimit)
  await app.register(fioLogger)
  await registerOpenAPI(app)

  // Register route plugins
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(customerRoutes)
  await app.register(chargeRoutes, { provider, pixKey })
  await app.register(planRoutes)
  await app.register(subscriptionRoutes, { provider })
  await app.register(invoiceRoutes)
  await app.register(webhookEndpointRoutes)
  await app.register(webhookDeliveryRoutes)
  await app.register(metricsRoutes)
  await app.register(testRoutes, { provider })
  await app.register(efiCallbackRoutes)

  const port = Number(process.env['PORT'] ?? 3000)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`Server listening on ${host}:${port}`)

  // Start background workers (requires REDIS_URL)
  const workers: Worker[] = []
  if (process.env['REDIS_URL']) {
    workers.push(
      startBillingCycleWorker({ provider, pixKey }),
      startDunningRetryWorker({ provider, pixKey }),
      startWebhookDeliveryWorker(),
      startChargeExpirationWorker(),
      startIdempotencyCleanupWorker(),
      startPixAutomaticoConsentWorker({ provider }),
      startApiKeyRevocationWorker(),
    )

    // Schedule periodic jobs
    await getBillingCycleQueue().add('billing-cycle', {}, {
      repeat: { every: 60_000 }, // every minute
    })
    await getChargeExpirationQueue().add('charge-expiration', {}, {
      repeat: { every: 60_000 }, // every minute
    })
    await getIdempotencyCleanupQueue().add('idempotency-cleanup', {}, {
      repeat: { every: 3_600_000 }, // every hour
    })
    await getApiKeyRevocationQueue().add('api-key-revocation', {}, {
      repeat: { every: 3_600_000 }, // every hour
    })

    app.log.info(`Started ${workers.length} background workers`)
  } else {
    app.log.warn('REDIS_URL not set — background workers disabled')
  }

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)

    try {
      await Promise.all(workers.map((w) => w.close()))
      await app.close()
      await closeDatabase()
      await closeQueues()
      app.log.info('Shutdown complete')
      process.exit(0)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      app.log.error(`Error during shutdown: ${message}`)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

start().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown error'
  console.error(`Failed to start server: ${message}`)
  process.exit(1)
})
