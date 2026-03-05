# Webhook Events Contract

**Delivery**: POST to registered endpoint URL.
**Signature**: HMAC-SHA256 in `Fio-Signature` header.
**Format**: `t={timestamp},v1={signature}` (Stripe-style).
**Payload content type**: `application/json`.
**Retry schedule**: 1min, 5min, 30min, 2h, 24h (5 attempts).
**Timeout**: 10 seconds per delivery attempt.

## Signature Verification

```
expected = HMAC-SHA256(
  key: webhook_secret,
  message: "{timestamp}.{raw_body}"
)
compare(signature, expected)
reject if abs(now - timestamp) > 300 seconds (replay protection)
```

## Payload Format

```json
{
  "id": "evt_abc123",
  "type": "charge.paid",
  "created_at": "2026-03-04T10:05:30Z",
  "data": {
    "id": "chg_def456",
    "customer_id": "cus_xyz789",
    "amount": 4990,
    "status": "paid",
    "payment_method_type": "pix",
    "paid_at": "2026-03-04T10:05:30Z",
    "...": "full entity snapshot"
  }
}
```

`data` always contains the **full entity snapshot** at the time of the
event — not just IDs or changed fields.

## Event Types

### Charge Events

| Event | Trigger |
|-------|---------|
| `charge.created` | New charge created (standalone or billing cycle) |
| `charge.paid` | Payment confirmed via PIX |
| `charge.failed` | Payment failed (timeout, PSP error) |
| `charge.expired` | Charge expired before payment |
| `charge.refunded` | Full refund processed |
| `charge.partially_refunded` | Partial refund processed |

### Subscription Events

| Event | Trigger |
|-------|---------|
| `subscription.created` | New subscription created |
| `subscription.activated` | Subscription transitioned to `active` (from trialing or past_due) |
| `subscription.trial_ending` | Trial expires in 3 days (advance notice) |
| `subscription.past_due` | Billing charge failed, entering dunning |
| `subscription.canceled` | Subscription canceled (includes `cancellation_reason` in data) |
| `subscription.paused` | Subscription paused by developer |
| `subscription.resumed` | Subscription resumed from pause |

### Invoice Events

| Event | Trigger |
|-------|---------|
| `invoice.created` | New billing cycle invoice generated |
| `invoice.paid` | Invoice charge paid |
| `invoice.failed` | Invoice charge failed (enters dunning) |
| `invoice.retry` | Dunning retry charge generated |

### Customer Events

| Event | Trigger |
|-------|---------|
| `customer.created` | New customer record created |
| `customer.updated` | Customer fields updated |

### Pix Automático Events

| Event | Trigger |
|-------|---------|
| `pix_automatico.consent_approved` | Customer authorized recurring debit |
| `pix_automatico.consent_denied` | Customer denied or bank unsupported |
| `pix_automatico.consent_canceled` | Consent revoked by customer or developer |

## Example Payloads

### charge.paid

```json
{
  "id": "evt_ch001",
  "type": "charge.paid",
  "created_at": "2026-03-04T10:05:30Z",
  "data": {
    "id": "chg_def456",
    "customer_id": "cus_xyz789",
    "invoice_id": "inv_ghi012",
    "amount": 4990,
    "status": "paid",
    "payment_method_type": "pix",
    "pix_end_to_end_id": "E12345678920260304100530ABCDE",
    "paid_at": "2026-03-04T10:05:30Z",
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

### subscription.canceled

```json
{
  "id": "evt_sub001",
  "type": "subscription.canceled",
  "created_at": "2026-03-04T10:10:00Z",
  "data": {
    "id": "sub_jkl345",
    "customer_id": "cus_xyz789",
    "plan_id": "pln_mno678",
    "status": "canceled",
    "cancellation_reason": "dunning_failed",
    "canceled_at": "2026-03-04T10:10:00Z",
    "current_period_start": "2026-02-04T00:00:00Z",
    "current_period_end": "2026-03-04T00:00:00Z",
    "created_at": "2026-01-04T10:00:00Z"
  }
}
```

### invoice.retry

```json
{
  "id": "evt_inv001",
  "type": "invoice.retry",
  "created_at": "2026-03-05T10:00:00Z",
  "data": {
    "id": "inv_ghi012",
    "subscription_id": "sub_jkl345",
    "customer_id": "cus_xyz789",
    "amount": 4990,
    "status": "open",
    "attempt_number": 2,
    "due_date": "2026-03-04",
    "period_start": "2026-03-04T00:00:00Z",
    "period_end": "2026-04-04T00:00:00Z"
  }
}
```
