# API Contract: Fio v1

**Base URL**: `https://api.{domain}/v1`
**Auth**: `Authorization: Bearer fio_{test|live}_...`
**Content-Type**: `application/json`
**Idempotency**: `Idempotency-Key` header on POST/PUT
**Rate Limit Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`
**Pagination**: Cursor-based via `?starting_after={id}&limit={n}`
**Errors**: All in English. Structured JSON (see Error Format below).

## Error Format

```json
{
  "type": "validation_error",
  "message": "Invalid CPF format. Expected: 123.456.789-00 or 12345678900",
  "code": "invalid_tax_id",
  "details": [
    {
      "field": "tax_id",
      "message": "CPF check digits do not match",
      "code": "invalid_cpf"
    }
  ]
}
```

**Error types**: `validation_error`, `authentication_error`,
`not_found_error`, `conflict_error`, `rate_limit_error`,
`idempotency_error`, `state_transition_error`, `internal_error`.

## Pagination Response Format

```json
{
  "data": [...],
  "has_more": true,
  "next_cursor": "cus_abc123"
}
```

---

## Customers

### POST /v1/customers

Create a customer.

**Request**:
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "tax_id": "12345678909",
  "tax_id_type": "cpf",
  "metadata": {}
}
```

**Response** (201):
```json
{
  "id": "cus_abc123",
  "name": "João Silva",
  "email": "joao@example.com",
  "tax_id": "123.456.789-09",
  "tax_id_type": "cpf",
  "metadata": {},
  "created_at": "2026-03-04T10:00:00Z",
  "updated_at": "2026-03-04T10:00:00Z"
}
```

**Errors**: 422 (invalid CPF/CNPJ, missing fields), 409 (duplicate
email or tax_id within account).

### GET /v1/customers/:id

**Response** (200): Customer object with `subscriptions` and `charges`
summary counts.

### PUT /v1/customers/:id

Update name, email, or metadata. Tax ID is immutable after creation.

### DELETE /v1/customers/:id

**Response** (204): Deleted.
**Errors**: 409 (has active subscriptions).

### GET /v1/customers

**Query params**: `starting_after`, `limit` (default 20, max 100),
`email` (filter).

---

## Plans

### POST /v1/plans

Create a subscription plan.

**Request**:
```json
{
  "name": "Pro Mensal",
  "amount": 4990,
  "interval": "month",
  "trial_days": 14,
  "dunning_schedule": [1, 3, 7],
  "metadata": {}
}
```

**Response** (201): Plan object.

**Validation**: `amount >= 100` (R$1.00), `interval` in
`[week, month, year]`, `trial_days >= 0`.

### GET /v1/plans/:id

### DELETE /v1/plans/:id

Archives the plan (soft delete). Returns 200 with `active: false`.

### GET /v1/plans

**Query params**: `starting_after`, `limit`, `active` (boolean filter).

---

## Subscriptions

### POST /v1/subscriptions

Create a subscription.

**Request**:
```json
{
  "customer_id": "cus_abc123",
  "plan_id": "pln_xyz789",
  "pix_automatico": false,
  "cancel_at_period_end": false,
  "metadata": {}
}
```

**Response** (201): Subscription object.

**Behavior**:
- If plan has `trial_days > 0`: status = `trialing`, no charge.
- If plan has `trial_days = 0`: status = `active`, first charge
  generated immediately (returned in `latest_invoice`).
- If `pix_automatico: true`: consent flow initiated, webhook emitted
  on consent response.

### GET /v1/subscriptions/:id

**Response** (200): Subscription object including `current_period_start`,
`current_period_end`, `latest_invoice`, `plan` (expanded).

### POST /v1/subscriptions/:id/cancel

**Request**:
```json
{
  "cancel_at_period_end": true
}
```

If `cancel_at_period_end: true`, subscription stays active until period
end. If `false` (or omitted), cancels immediately.

**Response** (200): Updated subscription with `status: canceled` or
`cancel_at_period_end: true`.

### POST /v1/subscriptions/:id/pause

**Response** (200): Subscription with `status: paused`.
**Errors**: 422 if not in `active` state.

### POST /v1/subscriptions/:id/resume

**Response** (200): Subscription with `status: active`, recalculated
`current_period_end`.
**Errors**: 422 if not in `paused` state.

### GET /v1/subscriptions

**Query params**: `starting_after`, `limit`, `status` (filter),
`customer_id` (filter).

---

## Charges

### POST /v1/charges

Create a standalone PIX charge.

**Request**:
```json
{
  "customer_id": "cus_abc123",
  "amount": 15000,
  "expires_in": 3600,
  "description": "Pagamento avulso",
  "metadata": {}
}
```

`expires_in`: seconds (default 3600, max 86400).

**Response** (201):
```json
{
  "id": "chg_def456",
  "customer_id": "cus_abc123",
  "amount": 15000,
  "status": "pending",
  "payment_method_type": "pix",
  "pix_qr_code": "00020101021226870014br.gov.bcb.pix...",
  "pix_qr_code_image": "data:image/png;base64,...",
  "pix_copy_paste": "00020101021226870014br.gov.bcb.pix...",
  "expires_at": "2026-03-04T11:00:00Z",
  "created_at": "2026-03-04T10:00:00Z"
}
```

### GET /v1/charges/:id

### POST /v1/charges/:id/refund

**Request**:
```json
{
  "amount": 5000
}
```

If `amount` omitted, full refund. Partial refund if amount < charge
amount.

**Response** (200): Updated charge with `status: refunded` or
`partially_refunded`, `refunded_amount` updated.

**Errors**: 422 (charge not paid), 422 (refund exceeds paid amount).

### GET /v1/charges

**Query params**: `starting_after`, `limit`, `status`, `customer_id`.

---

## Invoices

### GET /v1/invoices/:id

**Response** (200): Invoice with expanded `subscription`, `charge`.

### GET /v1/invoices

**Query params**: `starting_after`, `limit`, `subscription_id`,
`status`.

---

## Webhook Endpoints

### POST /v1/webhook-endpoints

**Request**:
```json
{
  "url": "https://myapp.com/webhooks/fio",
  "event_types": ["charge.paid", "subscription.canceled"]
}
```

If `event_types` omitted or null, endpoint receives all events.

**Response** (201): Webhook endpoint with `secret` (shown once).

### GET /v1/webhook-endpoints

### DELETE /v1/webhook-endpoints/:id

---

## Webhook Deliveries

### GET /v1/webhook-deliveries

**Query params**: `starting_after`, `limit`, `status`,
`webhook_endpoint_id`, `event_id`.

**Response**: List of delivery attempts with status, response code,
response time.

---

## Metrics

### GET /v1/metrics

**Response** (200):
```json
{
  "mrr": 249500,
  "active_subscriptions": 50,
  "churn_rate": 0.05,
  "churn_period_days": 30
}
```

`mrr` in centavos. `churn_rate` as decimal (0.05 = 5%).

---

## Sandbox-Only Endpoints

### POST /v1/test/charges/:id/pay

Simulate payment for a sandbox charge.

**Response** (200): Updated charge with `status: paid`.

### POST /v1/test/time/advance

Advance sandbox time to trigger billing cycles and dunning.

**Request**:
```json
{
  "days": 1
}
```

**Response** (200): Summary of triggered events (billing cycles
generated, dunning retries executed).
