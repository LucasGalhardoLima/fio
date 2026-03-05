import { FioClient, type FioOptions } from './client.js'
import { Customers } from './resources/customers.js'
import { Plans } from './resources/plans.js'
import { Subscriptions } from './resources/subscriptions.js'
import { Charges } from './resources/charges.js'
import { Invoices } from './resources/invoices.js'
import { WebhookEndpoints } from './resources/webhook-endpoints.js'
import { TestResource } from './resources/test.js'
import { verifyWebhookSignature } from './webhooks.js'

export class Fio {
  readonly customers: Customers
  readonly plans: Plans
  readonly subscriptions: Subscriptions
  readonly charges: Charges
  readonly invoices: Invoices
  readonly webhookEndpoints: WebhookEndpoints
  readonly test: TestResource

  private readonly client: FioClient

  constructor(options: FioOptions) {
    this.client = new FioClient(options)
    this.customers = new Customers(this.client)
    this.plans = new Plans(this.client)
    this.subscriptions = new Subscriptions(this.client)
    this.charges = new Charges(this.client)
    this.invoices = new Invoices(this.client)
    this.webhookEndpoints = new WebhookEndpoints(this.client)
    this.test = this.client.environment === 'test' ? new TestResource(this.client) : (null as unknown as TestResource)
  }

  static webhooks = {
    verify: verifyWebhookSignature,
  }
}

// Re-exports
export { FioClient, type FioOptions } from './client.js'
export {
  FioError,
  FioValidationError,
  FioAuthError,
  FioNotFoundError,
  FioRateLimitError,
  FioConflictError,
} from './errors.js'
export { verifyWebhookSignature } from './webhooks.js'
export type { CreateCustomerParams, UpdateCustomerParams, ListCustomersParams } from './resources/customers.js'
export type { CreatePlanParams, ListPlansParams } from './resources/plans.js'
export type {
  CreateSubscriptionParams,
  CancelSubscriptionParams,
  ListSubscriptionsParams,
} from './resources/subscriptions.js'
export type { CreateChargeParams, RefundChargeParams, ListChargesParams } from './resources/charges.js'
export type { ListInvoicesParams } from './resources/invoices.js'
export type { CreateWebhookEndpointParams, ListWebhookEndpointsParams } from './resources/webhook-endpoints.js'
export type { AdvanceTimeResult } from './resources/test.js'
export type { WebhookVerifyOptions } from './webhooks.js'
