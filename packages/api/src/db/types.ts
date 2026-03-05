import type { Generated, Insertable, Selectable, Updateable } from 'kysely'

export interface Database {
  accounts: AccountsTable
  api_keys: ApiKeysTable
  customers: CustomersTable
  plans: PlansTable
  subscriptions: SubscriptionsTable
  invoices: InvoicesTable
  charges: ChargesTable
  events: EventsTable
  webhook_endpoints: WebhookEndpointsTable
  webhook_deliveries: WebhookDeliveriesTable
  idempotency_keys: IdempotencyKeysTable
}

// --- accounts ---
export interface AccountsTable {
  id: Generated<string>
  name: string
  email: string
  password_hash: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export type AccountRow = Selectable<AccountsTable>
export type NewAccount = Insertable<AccountsTable>
export type AccountUpdate = Updateable<AccountsTable>

// --- api_keys ---
export interface ApiKeysTable {
  id: Generated<string>
  account_id: string
  key_hash: string
  key_prefix: string
  environment: string
  name: string | null
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Generated<Date>
}

export type ApiKeyRow = Selectable<ApiKeysTable>
export type NewApiKey = Insertable<ApiKeysTable>

// --- customers ---
export interface CustomersTable {
  id: Generated<string>
  account_id: string
  environment: string
  name: string
  email: string
  tax_id: string
  tax_id_type: string
  pix_automatico_consent_id: string | null
  pix_automatico_consent_status: string | null
  metadata: Generated<Record<string, unknown>>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export type CustomerRow = Selectable<CustomersTable>
export type NewCustomer = Insertable<CustomersTable>
export type CustomerUpdate = Updateable<CustomersTable>

// --- plans ---
export interface PlansTable {
  id: Generated<string>
  account_id: string
  environment: string
  name: string
  amount: number
  currency: Generated<string>
  interval: string
  trial_days: Generated<number>
  payment_methods: Generated<string[]>
  dunning_schedule: Generated<number[]>
  active: Generated<boolean>
  metadata: Generated<Record<string, unknown>>
  created_at: Generated<Date>
}

export type PlanRow = Selectable<PlansTable>
export type NewPlan = Insertable<PlansTable>

// --- subscriptions ---
export interface SubscriptionsTable {
  id: Generated<string>
  account_id: string
  environment: string
  customer_id: string
  plan_id: string
  status: string
  current_period_start: Date
  current_period_end: Date
  trial_end: Date | null
  cancel_at_period_end: Generated<boolean>
  canceled_at: Date | null
  cancellation_reason: string | null
  paused_at: Date | null
  pix_automatico: Generated<boolean>
  metadata: Generated<Record<string, unknown>>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export type SubscriptionRow = Selectable<SubscriptionsTable>
export type NewSubscription = Insertable<SubscriptionsTable>
export type SubscriptionUpdate = Updateable<SubscriptionsTable>

// --- invoices ---
export interface InvoicesTable {
  id: Generated<string>
  account_id: string
  environment: string
  subscription_id: string
  customer_id: string
  charge_id: string | null
  amount: number
  status: string
  period_start: Date
  period_end: Date
  due_date: Date
  paid_at: Date | null
  created_at: Generated<Date>
}

export type InvoiceRow = Selectable<InvoicesTable>
export type NewInvoice = Insertable<InvoicesTable>
export type InvoiceUpdate = Updateable<InvoicesTable>

// --- charges ---
export interface ChargesTable {
  id: Generated<string>
  account_id: string
  environment: string
  customer_id: string
  invoice_id: string | null
  amount: number
  status: string
  payment_method_type: Generated<string>
  pix_qr_code: string | null
  pix_qr_code_image: string | null
  pix_copy_paste: string | null
  pix_end_to_end_id: string | null
  provider: Generated<string>
  provider_reference: string | null
  idempotency_key: string | null
  expires_at: Date
  paid_at: Date | null
  refunded_amount: Generated<number>
  metadata: Generated<Record<string, unknown>>
  created_at: Generated<Date>
}

export type ChargeRow = Selectable<ChargesTable>
export type NewCharge = Insertable<ChargesTable>
export type ChargeUpdate = Updateable<ChargesTable>

// --- events ---
export interface EventsTable {
  id: Generated<string>
  account_id: string
  environment: string
  event_type: string
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
  metadata: Generated<Record<string, unknown>>
  idempotency_key: string | null
  created_at: Generated<Date>
}

export type EventRow = Selectable<EventsTable>
export type NewEvent = Insertable<EventsTable>

// --- webhook_endpoints ---
export interface WebhookEndpointsTable {
  id: Generated<string>
  account_id: string
  environment: string
  url: string
  secret: string
  event_types: string[] | null
  active: Generated<boolean>
  created_at: Generated<Date>
}

export type WebhookEndpointRow = Selectable<WebhookEndpointsTable>
export type NewWebhookEndpoint = Insertable<WebhookEndpointsTable>

// --- webhook_deliveries ---
export interface WebhookDeliveriesTable {
  id: Generated<string>
  webhook_endpoint_id: string
  event_id: string
  status: string
  attempts: Generated<number>
  max_attempts: Generated<number>
  next_attempt_at: Date | null
  last_attempt_at: Date | null
  response_status_code: number | null
  response_body: string | null
  response_time_ms: number | null
  created_at: Generated<Date>
}

export type WebhookDeliveryRow = Selectable<WebhookDeliveriesTable>
export type NewWebhookDelivery = Insertable<WebhookDeliveriesTable>
export type WebhookDeliveryUpdate = Updateable<WebhookDeliveriesTable>

// --- idempotency_keys ---
export interface IdempotencyKeysTable {
  id: Generated<string>
  account_id: string
  key: string
  method: string
  path: string
  response_status: number
  response_body: Record<string, unknown>
  created_at: Generated<Date>
  expires_at: Date
}

export type IdempotencyKeyRow = Selectable<IdempotencyKeysTable>
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>
