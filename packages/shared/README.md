# @fio-pay/shared

Shared types, Zod schemas, and constants for the [Fio](https://fio.com.br) billing API. Used internally by `@fio-pay/sdk` and useful for server-side integrations that need Fio type definitions.

## Install

```bash
npm install @fio-pay/shared
```

## What's included

**Constants** - Status enums, event types, and configuration values:

```ts
import {
  SUBSCRIPTION_STATUS,  // trialing, active, past_due, canceled, paused
  CHARGE_STATUS,         // pending, paid, failed, expired, refunded, partially_refunded
  INVOICE_STATUS,        // draft, open, paid, failed, void
  EVENT_TYPES,           // charge.created, subscription.activated, etc.
  PLAN_INTERVAL,         // week, month, year
  API_KEY_PREFIX,        // fio_test_, fio_live_
} from '@fio-pay/shared'
```

**Types** - TypeScript interfaces for all API entities:

```ts
import type {
  Customer,
  Plan,
  Subscription,
  Charge,
  Invoice,
  WebhookEndpoint,
  Event,
  ErrorResponse,
} from '@fio-pay/shared'
```

**Zod schemas** - Runtime validation for API payloads:

```ts
import { customerSchema, planSchema, chargeSchema } from '@fio-pay/shared'
```

## Subpath exports

```ts
import { SUBSCRIPTION_STATUS } from '@fio-pay/shared/constants'
import { customerSchema } from '@fio-pay/shared/schemas'
import type { Customer } from '@fio-pay/shared/types'
```

## Money convention

All monetary values are integers in **centavos** (1/100 of BRL). For example, R$49.90 = `4990`. Never use floats for money.

## Requirements

- Node.js 20+
- ESM only (`"type": "module"`)

## License

MIT
