import type {
  CancellationReason,
  ChargeStatus,
  EntityType,
  Environment,
  EventType,
  InvoiceStatus,
  PaymentMethodType,
  PixAutomaticoConsentStatus,
  PlanInterval,
  SubscriptionStatus,
} from '../constants.js'

export interface Account {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  account_id: string
  key_prefix: string
  environment: Environment
  name: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface Customer {
  id: string
  account_id: string
  environment: Environment
  name: string
  email: string
  tax_id: string
  tax_id_type: 'cpf' | 'cnpj'
  pix_automatico_consent_id: string | null
  pix_automatico_consent_status: PixAutomaticoConsentStatus | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  account_id: string
  environment: Environment
  name: string
  amount: number
  currency: string
  interval: PlanInterval
  trial_days: number
  payment_methods: PaymentMethodType[]
  dunning_schedule: number[]
  active: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface Subscription {
  id: string
  account_id: string
  environment: Environment
  customer_id: string
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  trial_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  cancellation_reason: CancellationReason | null
  paused_at: string | null
  pix_automatico: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  account_id: string
  environment: Environment
  subscription_id: string
  customer_id: string
  charge_id: string | null
  amount: number
  status: InvoiceStatus
  period_start: string
  period_end: string
  due_date: string
  paid_at: string | null
  created_at: string
}

export interface Charge {
  id: string
  account_id: string
  environment: Environment
  customer_id: string
  invoice_id: string | null
  amount: number
  status: ChargeStatus
  payment_method_type: PaymentMethodType
  pix_qr_code: string | null
  pix_qr_code_image: string | null
  pix_copy_paste: string | null
  pix_end_to_end_id: string | null
  provider: string
  provider_reference: string | null
  idempotency_key: string | null
  expires_at: string
  paid_at: string | null
  refunded_amount: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface Event {
  id: string
  account_id: string
  environment: Environment
  event_type: EventType
  entity_type: EntityType
  entity_id: string
  data: Record<string, unknown>
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
}

export interface WebhookEndpoint {
  id: string
  account_id: string
  environment: Environment
  url: string
  secret: string
  event_types: EventType[] | null
  active: boolean
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_endpoint_id: string
  event_id: string
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  max_attempts: number
  next_attempt_at: string | null
  last_attempt_at: string | null
  response_status_code: number | null
  response_body: string | null
  response_time_ms: number | null
  created_at: string
}

export interface IdempotencyKey {
  id: string
  account_id: string
  key: string
  method: string
  path: string
  response_status: number
  response_body: Record<string, unknown>
  created_at: string
  expires_at: string
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

// Error response
export interface ErrorResponse {
  type: string
  message: string
  code: string
  details: ErrorDetail[]
}

export interface ErrorDetail {
  field: string
  message: string
  code: string
}

// Metrics
export interface Metrics {
  mrr: number
  active_subscriptions: number
  churn_rate: number
  churn_period_days: number
}
