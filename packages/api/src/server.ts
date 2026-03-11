import { buildApp } from './app.js'
import { closeDatabase } from './db/connection.js'
import { startBoss, stopBoss, getBoss } from './jobs/queue-setup.js'
import { registerBillingCycleWorker } from './jobs/billing-cycle.js'
import { registerDunningRetryWorker } from './jobs/dunning-retry.js'
import { registerWebhookDeliveryWorker } from './jobs/webhook-delivery.js'
import { registerChargeExpirationWorker } from './jobs/charge-expiration.js'
import { registerIdempotencyCleanupWorker } from './jobs/idempotency-cleanup.js'
import { registerPixAutomaticoConsentWorker } from './jobs/pix-automatico-consent.js'
import { registerApiKeyRevocationWorker } from './jobs/api-key-revocation.js'
import { customerRoutes } from './routes/v1/customers.js'
import { chargeRoutes } from './routes/v1/charges.js'
import { planRoutes } from './routes/v1/plans.js'
import { subscriptionRoutes } from './routes/v1/subscriptions.js'
import { invoiceRoutes } from './routes/v1/invoices.js'
import { webhookEndpointRoutes } from './routes/v1/webhook-endpoints.js'
import { webhookDeliveryRoutes } from './routes/v1/webhook-deliveries.js'
import { apiKeyRoutes } from './routes/v1/api-keys.js'
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
  await app.register(apiKeyRoutes)
  await app.register(metricsRoutes)
  await app.register(testRoutes, { provider })
  await app.register(efiCallbackRoutes)

  const port = Number(process.env['PORT'] ?? 3000)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`Server listening on ${host}:${port}`)

  // Start pg-boss and register background workers
  await startBoss()
  const boss = getBoss()

  await registerBillingCycleWorker(boss, { provider, pixKey })
  await registerDunningRetryWorker(boss, { provider, pixKey })
  await registerWebhookDeliveryWorker(boss)
  await registerChargeExpirationWorker(boss)
  await registerIdempotencyCleanupWorker(boss)
  await registerPixAutomaticoConsentWorker(boss, { provider })
  await registerApiKeyRevocationWorker(boss)

  app.log.info('Background workers registered (pg-boss)')

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)

    try {
      await stopBoss()
      await app.close()
      await closeDatabase()
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
