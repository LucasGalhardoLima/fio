// Subscription states — managed by state machine
export const SUBSCRIPTION_STATUS = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  PAUSED: 'paused',
} as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]

// Charge states — managed by state machine
export const CHARGE_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const

export type ChargeStatus = (typeof CHARGE_STATUS)[keyof typeof CHARGE_STATUS]

// Invoice states — managed by state machine
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  FAILED: 'failed',
  VOID: 'void',
} as const

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS]

// Payment method types — PIX only in v1
export const PAYMENT_METHOD_TYPE = {
  PIX: 'pix',
  CARD: 'card',
  BOLETO: 'boleto',
} as const

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPE)[keyof typeof PAYMENT_METHOD_TYPE]

// Plan intervals
export const PLAN_INTERVAL = {
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
} as const

export type PlanInterval = (typeof PLAN_INTERVAL)[keyof typeof PLAN_INTERVAL]

// Environment
export const ENVIRONMENT = {
  TEST: 'test',
  LIVE: 'live',
} as const

export type Environment = (typeof ENVIRONMENT)[keyof typeof ENVIRONMENT]

// API key prefixes
export const API_KEY_PREFIX = {
  TEST: 'fio_test_',
  LIVE: 'fio_live_',
} as const

// Event types
export const EVENT_TYPES = {
  // Charge events
  CHARGE_CREATED: 'charge.created',
  CHARGE_PAID: 'charge.paid',
  CHARGE_FAILED: 'charge.failed',
  CHARGE_EXPIRED: 'charge.expired',
  CHARGE_REFUNDED: 'charge.refunded',
  CHARGE_PARTIALLY_REFUNDED: 'charge.partially_refunded',
  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_TRIAL_ENDING: 'subscription.trial_ending',
  SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  SUBSCRIPTION_PAUSED: 'subscription.paused',
  SUBSCRIPTION_RESUMED: 'subscription.resumed',
  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_FAILED: 'invoice.failed',
  INVOICE_RETRY: 'invoice.retry',
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  // Pix Automático events
  PIX_AUTOMATICO_CONSENT_APPROVED: 'pix_automatico.consent_approved',
  PIX_AUTOMATICO_CONSENT_DENIED: 'pix_automatico.consent_denied',
  PIX_AUTOMATICO_CONSENT_CANCELED: 'pix_automatico.consent_canceled',
} as const

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]

// Entity types for events
export const ENTITY_TYPES = {
  CHARGE: 'charge',
  SUBSCRIPTION: 'subscription',
  CUSTOMER: 'customer',
  INVOICE: 'invoice',
} as const

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]

// Cancellation reasons
export const CANCELLATION_REASON = {
  DUNNING_FAILED: 'dunning_failed',
  DEVELOPER_REQUEST: 'developer_request',
  CUSTOMER_REQUEST: 'customer_request',
} as const

export type CancellationReason = (typeof CANCELLATION_REASON)[keyof typeof CANCELLATION_REASON]

// Pix Automático consent status
export const PIX_AUTOMATICO_CONSENT_STATUS = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  DENIED: 'denied',
  CANCELED: 'canceled',
} as const

export type PixAutomaticoConsentStatus =
  (typeof PIX_AUTOMATICO_CONSENT_STATUS)[keyof typeof PIX_AUTOMATICO_CONSENT_STATUS]

// Default dunning schedule (days after failure)
export const DEFAULT_DUNNING_SCHEDULE = [1, 3, 7] as const

// Webhook retry schedule (milliseconds)
export const WEBHOOK_RETRY_SCHEDULE = [
  60_000, // 1 minute
  300_000, // 5 minutes
  1_800_000, // 30 minutes
  7_200_000, // 2 hours
  86_400_000, // 24 hours
] as const

export const MAX_WEBHOOK_ATTEMPTS = 5

// Money constraints
export const MIN_CHARGE_AMOUNT = 100 // R$1.00 in centavos
