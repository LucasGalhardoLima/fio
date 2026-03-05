# Data Model: Subscription Billing MVP

**Source**: spec.md Key Entities + PRD Appendix A
**Database**: PostgreSQL 16 with Kysely query builder
**Conventions**: All monetary values in centavos (integer). All
timestamps in UTC. All tables scoped by `account_id`. Sandbox/production
isolated by `environment` column derived from API key prefix.

## Entity Relationship Overview

```
Account 1──* Customer 1──* Subscription *──1 Plan
                │                │
                │                ├──* Invoice 1──1 Charge
                │                │
                └──* Charge      └──* Event
                     │
                     └──? Invoice

Account 1──* Plan
Account 1──* Event
Account 1──* WebhookEndpoint 1──* WebhookDelivery
Event 1──* WebhookDelivery
```

## Tables

### accounts

Developer accounts on Fio. Top-level tenant isolation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| name | varchar(255) | NOT NULL | Developer/company name |
| email | varchar(255) | NOT NULL, UNIQUE | Login email |
| password_hash | varchar(255) | NOT NULL | Argon2 hash |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

### api_keys

Separate table for API keys — supports rotation with grace period.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| key_hash | varchar(255) | NOT NULL | Argon2 hash of full key |
| key_prefix | varchar(32) | NOT NULL | First 12 chars for identification (e.g., `fio_test_abc1`) |
| environment | varchar(4) | NOT NULL, CHECK (test\|live) | Derived from key prefix |
| name | varchar(255) | | Optional label |
| expires_at | timestamptz | | NULL = no expiry; set to now()+24h on rotation |
| revoked_at | timestamptz | | NULL = active |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(key_prefix)` for fast lookup, `(account_id, environment)`
for listing.

### customers

End users of the developer's product.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | test \| live |
| name | varchar(255) | NOT NULL | |
| email | varchar(255) | NOT NULL | |
| tax_id | varchar(14) | NOT NULL | CPF (11 digits) or CNPJ (14 digits), digits only |
| tax_id_type | varchar(4) | NOT NULL, CHECK (cpf\|cnpj) | |
| pix_automatico_consent_id | varchar(255) | | Efí consent ID, nullable |
| pix_automatico_consent_status | varchar(32) | | authorized\|denied\|pending\|canceled |
| metadata | jsonb | DEFAULT '{}' | Developer-defined metadata |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `UNIQUE (account_id, environment, email)`,
`UNIQUE (account_id, environment, tax_id)`,
`(account_id, environment, created_at)` for cursor pagination.

### plans

Subscription templates. Immutable after creation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| name | varchar(255) | NOT NULL | |
| amount | integer | NOT NULL, CHECK (>= 100) | BRL centavos, min R$1.00 |
| currency | varchar(3) | NOT NULL, DEFAULT 'BRL' | |
| interval | varchar(5) | NOT NULL, CHECK (week\|month\|year) | |
| trial_days | integer | NOT NULL, DEFAULT 0 | |
| payment_methods | jsonb | NOT NULL, DEFAULT '["pix"]' | Prepared for multi-method |
| dunning_schedule | jsonb | DEFAULT '[1, 3, 7]' | Days after failure for retries |
| active | boolean | NOT NULL, DEFAULT true | false = archived |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(account_id, environment, active)` for listing.

### subscriptions

Links a customer to a plan. Managed by the state machine.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| customer_id | uuid | FK customers(id), NOT NULL | |
| plan_id | uuid | FK plans(id), NOT NULL | |
| status | varchar(10) | NOT NULL, CHECK (trialing\|active\|past_due\|canceled\|paused) | |
| current_period_start | timestamptz | NOT NULL | |
| current_period_end | timestamptz | NOT NULL | |
| trial_end | timestamptz | | NULL if no trial |
| cancel_at_period_end | boolean | NOT NULL, DEFAULT false | |
| canceled_at | timestamptz | | |
| cancellation_reason | varchar(50) | | dunning_failed\|developer_request\|customer_request |
| paused_at | timestamptz | | |
| pix_automatico | boolean | NOT NULL, DEFAULT false | Whether to attempt Pix Automático |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(account_id, environment, status)`,
`(account_id, environment, customer_id)`,
`(current_period_end, status)` for billing cycle job (find due subscriptions).

### invoices

Represents a single billing cycle.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| subscription_id | uuid | FK subscriptions(id), NOT NULL | |
| customer_id | uuid | FK customers(id), NOT NULL | |
| charge_id | uuid | FK charges(id) | Linked after charge creation |
| amount | integer | NOT NULL | BRL centavos |
| status | varchar(6) | NOT NULL, CHECK (draft\|open\|paid\|failed\|void) | |
| period_start | timestamptz | NOT NULL | |
| period_end | timestamptz | NOT NULL | |
| due_date | date | NOT NULL | |
| paid_at | timestamptz | | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(subscription_id, period_start)`,
`(account_id, environment, status)`.

### charges

A single PIX payment request. Can be standalone or linked to an invoice.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| customer_id | uuid | FK customers(id), NOT NULL | |
| invoice_id | uuid | FK invoices(id) | NULL for standalone charges |
| amount | integer | NOT NULL, CHECK (>= 100) | BRL centavos |
| status | varchar(20) | NOT NULL, CHECK (pending\|paid\|failed\|expired\|refunded\|partially_refunded) | |
| payment_method_type | varchar(6) | NOT NULL, DEFAULT 'pix' | pix\|card\|boleto |
| pix_qr_code | text | | EMV copia-e-cola string |
| pix_qr_code_image | text | | Base64 PNG data URI |
| pix_copy_paste | text | | Alias for qr_code (user-facing) |
| pix_end_to_end_id | varchar(50) | | From Efí webhook — required for refunds |
| provider | varchar(20) | NOT NULL, DEFAULT 'efi' | PSP identifier |
| provider_reference | varchar(100) | | Efí txid |
| idempotency_key | varchar(255) | | |
| expires_at | timestamptz | NOT NULL | |
| paid_at | timestamptz | | |
| refunded_amount | integer | DEFAULT 0 | Cumulative refunds in centavos |
| metadata | jsonb | DEFAULT '{}' | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `UNIQUE (account_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
`(account_id, environment, status)`,
`(provider, provider_reference)` for webhook matching,
`(expires_at, status)` for expiration job.

### events

Append-only event log. Source of truth for audit trail and analytics.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| event_type | varchar(50) | NOT NULL | e.g., charge.paid, subscription.canceled |
| entity_type | varchar(20) | NOT NULL | charge\|subscription\|customer\|invoice |
| entity_id | uuid | NOT NULL | |
| data | jsonb | NOT NULL | Full entity snapshot at time of event |
| metadata | jsonb | DEFAULT '{}' | agent_id, ip, sdk_version, etc. |
| idempotency_key | varchar(255) | | Prevents duplicate events |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(account_id, environment, event_type, created_at)`,
`(entity_type, entity_id, created_at)`,
`UNIQUE (idempotency_key) WHERE idempotency_key IS NOT NULL`.

**Constraints**: No UPDATE or DELETE triggers. This table is append-only.

### webhook_endpoints

Developer-registered URLs for receiving event notifications.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| environment | varchar(4) | NOT NULL | |
| url | varchar(2048) | NOT NULL | HTTPS required |
| secret | varchar(255) | NOT NULL | HMAC signing secret |
| event_types | jsonb | DEFAULT NULL | NULL = all events; array = filtered |
| active | boolean | NOT NULL, DEFAULT true | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(account_id, environment, active)`.

### webhook_deliveries

Record of each delivery attempt for an event to an endpoint.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| webhook_endpoint_id | uuid | FK webhook_endpoints(id), NOT NULL | |
| event_id | uuid | FK events(id), NOT NULL | |
| status | varchar(10) | NOT NULL, CHECK (pending\|delivered\|failed) | |
| attempts | integer | NOT NULL, DEFAULT 0 | |
| max_attempts | integer | NOT NULL, DEFAULT 5 | |
| next_attempt_at | timestamptz | | Scheduled retry time |
| last_attempt_at | timestamptz | | |
| response_status_code | integer | | |
| response_body | text | | Truncated to 1KB |
| response_time_ms | integer | | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes**: `(status, next_attempt_at)` for retry job,
`(webhook_endpoint_id, created_at)` for dashboard log.

### idempotency_keys

Tracks idempotency key results for replay.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| account_id | uuid | FK accounts(id), NOT NULL | |
| key | varchar(255) | NOT NULL | |
| method | varchar(6) | NOT NULL | POST\|PUT |
| path | varchar(500) | NOT NULL | |
| response_status | integer | NOT NULL | |
| response_body | jsonb | NOT NULL | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| expires_at | timestamptz | NOT NULL | 24h TTL |

**Indexes**: `UNIQUE (account_id, key)`,
`(expires_at)` for cleanup job.

## State Machines

### Subscription States

```
                    ┌──────────────────┐
                    │                  │
    ┌───────────┐   │   ┌──────────┐  │   ┌───────────┐
    │ trialing  │───┼──▶│  active   │──┼──▶│  canceled  │
    └───────────┘   │   └──────────┘  │   └───────────┘
                    │     │  ▲    │    │        ▲
                    │     │  │    │    │        │
                    │     ▼  │    ▼    │        │
                    │   ┌──────────┐   │   (all retries
                    │   │ past_due │───┘    exhausted)
                    │   └──────────┘
                    │     │  ▲
                    │     ▼  │
                    │   ┌──────────┐
                    │   │  paused  │
                    │   └──────────┘
                    │
                    └── (developer cancels from any state
                         except canceled)
```

**Valid transitions**:
| From | To | Trigger |
|------|----|---------|
| trialing | active | Trial period expires |
| trialing | canceled | Developer cancels |
| active | past_due | Billing cycle charge fails |
| active | canceled | Developer cancels |
| active | paused | Developer pauses |
| past_due | active | Retry charge succeeds |
| past_due | canceled | All retries exhausted (dunning_failed) |
| paused | active | Developer resumes |
| paused | canceled | Developer cancels |

### Charge States

```
pending → paid
pending → failed
pending → expired
paid → refunded
paid → partially_refunded
```

### Invoice States

```
draft → open (charge created)
open → paid (charge paid)
open → failed (charge failed / all retries exhausted)
open → void (subscription canceled before payment)
```
