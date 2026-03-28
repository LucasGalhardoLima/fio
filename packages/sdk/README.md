# @fio-pay/sdk

TypeScript SDK for the [Fio](https://fio.com.br) subscription billing API. Build recurring payments with PIX in minutes.

## Install

```bash
npm install @fio-pay/sdk
```

## Quick start

```ts
import { Fio } from '@fio-pay/sdk'

const fio = new Fio({ apiKey: 'fio_test_...' })

// Create a customer
const customer = await fio.customers.create({
  name: 'Maria Silva',
  taxId: '12345678900',
  email: 'maria@example.com',
})

// Create a plan
const plan = await fio.plans.create({
  name: 'Pro',
  amountCentavos: 4990, // R$49.90
  interval: 'month',
  intervalCount: 1,
})

// Start a subscription
const subscription = await fio.subscriptions.create({
  customerId: customer.id,
  planId: plan.id,
})

// List charges
const charges = await fio.charges.list({ subscriptionId: subscription.id })
```

## Resources

| Resource              | Methods                                         |
| --------------------- | ----------------------------------------------- |
| `fio.customers`       | `create`, `get`, `update`, `list`               |
| `fio.plans`           | `create`, `get`, `list`                         |
| `fio.subscriptions`   | `create`, `get`, `cancel`, `list`               |
| `fio.charges`         | `create`, `get`, `refund`, `list`               |
| `fio.invoices`        | `get`, `list`                                   |
| `fio.webhookEndpoints`| `create`, `get`, `delete`, `list`               |
| `fio.test`            | `advanceTime` (test environment only)           |

## Webhook verification

```ts
import { Fio } from '@fio-pay/sdk'

const isValid = Fio.webhooks.verify({
  payload: rawBody,
  signature: headers['x-fio-signature'],
  secret: 'whsec_...',
})
```

## Error handling

```ts
import { Fio, FioValidationError, FioAuthError } from '@fio-pay/sdk'

try {
  await fio.customers.create({ name: '' })
} catch (err) {
  if (err instanceof FioValidationError) {
    console.log(err.errors) // validation details
  }
  if (err instanceof FioAuthError) {
    console.log('Invalid API key')
  }
}
```

## Configuration

```ts
const fio = new Fio({
  apiKey: 'fio_live_...', // or fio_test_ for sandbox
  baseUrl: 'https://api.fio.com.br/v1', // optional, defaults to production
})
```

The environment (`test` or `live`) is automatically detected from the API key prefix.

## Requirements

- Node.js 20+
- ESM only (`"type": "module"`)

## License

MIT
