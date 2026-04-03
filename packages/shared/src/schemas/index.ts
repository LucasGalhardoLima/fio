import { z } from 'zod'
import {
  CHARGE_STATUS,
  ENVIRONMENT,
  INVOICE_STATUS,
  MIN_CHARGE_AMOUNT,
  PAYMENT_METHOD_TYPE,
  PLAN_INTERVAL,
  SUBSCRIPTION_STATUS,
} from '../constants.js'

// Reusable primitives
const uuid = z.string().uuid()
const centavos = z.number().int().min(MIN_CHARGE_AMOUNT)
const positiveInt = z.number().int().positive()
const isoDatetime = z.string().datetime()
const metadata = z.record(z.unknown()).default({})

// Pagination params
export const paginationSchema = z.object({
  starting_after: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Customer schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  tax_id: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'Expected 11 digits (CPF) or 14 digits (CNPJ)'),
  tax_id_type: z.enum(['cpf', 'cnpj']),
  metadata: metadata.optional(),
})

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  metadata: metadata.optional(),
}).passthrough()

// Plan schemas
export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  amount: centavos,
  interval: z.enum([PLAN_INTERVAL.WEEK, PLAN_INTERVAL.MONTH, PLAN_INTERVAL.YEAR]),
  trial_days: z.number().int().min(0).default(0),
  dunning_schedule: z.array(positiveInt).min(1).max(10).default([1, 3, 7]),
  metadata: metadata.optional(),
})

// Subscription schemas
export const createSubscriptionSchema = z.object({
  customer_id: uuid,
  plan_id: uuid,
  pix_automatico: z.boolean().default(false),
  cancel_at_period_end: z.boolean().default(false),
  metadata: metadata.optional(),
})

export const cancelSubscriptionSchema = z.object({
  cancel_at_period_end: z.boolean().default(false),
})

// Charge schemas
export const createChargeSchema = z.object({
  customer_id: uuid,
  amount: centavos,
  expires_in: z.number().int().min(60).max(86400).default(3600),
  description: z.string().max(500).optional(),
  metadata: metadata.optional(),
})

export const refundChargeSchema = z.object({
  amount: z.number().int().positive().optional(),
})

// Webhook endpoint schemas
export const createWebhookEndpointSchema = z.object({
  url: z.string().url().startsWith('https://'),
  event_types: z.array(z.string()).nullable().optional(),
})

// Sandbox test schemas
export const advanceTimeSchema = z.object({
  days: z.number().int().min(1).max(365),
})

// ID param schema
export const idParamSchema = z.object({
  id: uuid,
})

// Common filter schemas
export const statusValues = {
  subscription: z.enum([
    SUBSCRIPTION_STATUS.TRIALING,
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.PAST_DUE,
    SUBSCRIPTION_STATUS.CANCELED,
    SUBSCRIPTION_STATUS.PAUSED,
  ]),
  charge: z.enum([
    CHARGE_STATUS.PENDING,
    CHARGE_STATUS.PAID,
    CHARGE_STATUS.FAILED,
    CHARGE_STATUS.EXPIRED,
    CHARGE_STATUS.REFUNDED,
    CHARGE_STATUS.PARTIALLY_REFUNDED,
  ]),
  invoice: z.enum([
    INVOICE_STATUS.DRAFT,
    INVOICE_STATUS.OPEN,
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.FAILED,
    INVOICE_STATUS.VOID,
  ]),
  environment: z.enum([ENVIRONMENT.TEST, ENVIRONMENT.LIVE]),
  paymentMethod: z.enum([
    PAYMENT_METHOD_TYPE.PIX,
    PAYMENT_METHOD_TYPE.CARD,
    PAYMENT_METHOD_TYPE.BOLETO,
  ]),
}
