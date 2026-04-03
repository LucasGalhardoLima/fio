# Feature Specification: Subscription Billing MVP for PIX

**Feature Branch**: `001-subscription-billing-mvp`
**Created**: 2026-03-03
**Status**: Draft
**Input**: PRD `fio-prd-mvp.md` — Fio v1.0 "Foundation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First PIX Charge in 5 Minutes (Priority: P1)

A developer registers for a Fio account, creates a customer record with
CPF/CNPJ, and generates a one-time PIX charge — receiving a QR code, a
QR code image URL, and a copy-paste string. The entire flow from signup
to generated QR code takes under 5 minutes.

**Why this priority**: This is the atomic unit of value. If a developer
cannot generate a PIX charge quickly, nothing else matters. It proves the
core integration works and delivers immediate value even without
subscriptions.

**Independent Test**: Create a customer, generate a charge, and verify
the QR code is returned. In sandbox, simulate payment and confirm the
charge status updates.

**Acceptance Scenarios**:

1. **Given** a registered developer with an API key, **When** they create
   a customer with valid CPF and then create a charge for that customer,
   **Then** the system returns a charge with QR code, QR code URL, and
   copy-paste string, with status `pending`.
2. **Given** a pending charge, **When** the customer pays via PIX,
   **Then** the charge status changes to `paid` and a notification is
   emitted.
3. **Given** a pending charge with 1-hour expiration, **When** the
   expiration time passes without payment, **Then** the charge status
   changes to `expired` and a notification is emitted.
4. **Given** an existing charge for a customer, **When** the developer
   sends the same idempotency key, **Then** the system returns the
   original charge without creating a duplicate.
5. **Given** a customer creation request with an invalid CPF, **When**
   the request is processed, **Then** the system returns a clear error
   indicating the expected CPF format.

---

### User Story 2 - Subscription with Automatic Billing Cycles (Priority: P2)

A developer creates a subscription plan (with name, price, and billing
interval) and subscribes a customer to it. On each billing cycle, the
system automatically generates a PIX charge for the customer without
any manual intervention from the developer.

**Why this priority**: Automatic recurring billing is the core value
proposition of Fio. Without it, the developer is just using a one-time
payment API. This turns Fio into a subscription engine.

**Independent Test**: Create a plan, subscribe a customer, advance to
the next billing cycle, and verify a charge is automatically generated.

**Acceptance Scenarios**:

1. **Given** a plan with monthly interval at R$ 49.90 (4990 centavos),
   **When** a customer is subscribed to it, **Then** the subscription
   is created with status `active` and the first billing cycle charge
   is generated immediately.
2. **Given** an active subscription, **When** the current billing period
   ends, **Then** the system automatically generates a new charge for
   the next cycle and creates an invoice record linking the subscription
   and charge.
3. **Given** a canceled or paused subscription, **When** the billing
   cycle date arrives, **Then** no charge is generated.
4. **Given** a subscription, **When** the developer queries it, **Then**
   the response includes current status, next billing date, and history
   of invoices.

---

### User Story 3 - Trial Periods and Smart Dunning (Priority: P3)

A developer configures a plan with N trial days. When a customer
subscribes, they enter a trial period with no charge. When the trial
expires, the first charge is generated automatically. If any payment
fails, the system retries automatically (D+1, D+3, D+7). If all retries
are exhausted, the subscription is automatically canceled.

**Why this priority**: Trial periods reduce friction for end-user
acquisition. Dunning recovers revenue that would otherwise be lost to
temporary payment failures. Together, they complete the subscription
lifecycle.

**Independent Test**: Subscribe a customer to a trial plan, advance
past trial end, verify charge is generated. Then simulate payment
failure and verify retry schedule executes correctly.

**Acceptance Scenarios**:

1. **Given** a plan with 14 trial days, **When** a customer subscribes,
   **Then** the subscription starts with status `trialing` and no charge
   is created until the trial ends.
2. **Given** a subscription in `trialing` status, **When** the trial
   period expires, **Then** the subscription transitions to `active` and
   the first billing charge is generated.
3. **Given** an active subscription, **When** a billing cycle charge
   fails, **Then** the subscription transitions to `past_due` and the
   system schedules retries at D+1, D+3, and D+7.
4. **Given** a subscription in `past_due` status, **When** a retry
   charge succeeds, **Then** the subscription transitions back to
   `active`.
5. **Given** a subscription in `past_due` status, **When** all retry
   attempts are exhausted, **Then** the subscription transitions to
   `canceled` with reason `dunning_failed` and a notification is emitted.
6. **Given** a plan, **When** the developer wants custom retry timing,
   **Then** the system allows configuring the dunning schedule per plan.

---

### User Story 4 - Real-time Webhooks with Verified Delivery (Priority: P4)

A developer registers a webhook endpoint URL. Every time a significant
event occurs (charge paid, subscription canceled, etc.), the system
delivers a signed payload to that URL. If delivery fails, the system
retries with exponential backoff.

**Why this priority**: Webhooks are how the developer's system reacts to
billing events (e.g., blocking access when a subscription is canceled).
Without webhooks, the developer must poll the API.

**Independent Test**: Register a webhook endpoint, trigger an event
(e.g., pay a charge), and verify the webhook is delivered with a valid
signature.

**Acceptance Scenarios**:

1. **Given** a registered webhook endpoint, **When** a charge is paid,
   **Then** the system delivers a payload containing the full charge
   snapshot, signed with HMAC-SHA256.
2. **Given** a webhook delivery that fails (endpoint returns 5xx or
   times out), **When** the first attempt fails, **Then** the system
   retries with exponential backoff (1min, 5min, 30min, 2h, 24h — 5
   attempts total).
3. **Given** a delivered webhook, **When** the developer uses the SDK
   verification helper, **Then** the signature is validated successfully
   against the webhook secret.
4. **Given** multiple events for the same entity, **When** each event
   is delivered, **Then** each payload has a unique event ID and the
   same event ID is never sent twice.
5. **Given** a developer's dashboard, **When** they view webhook
   deliveries, **Then** they see a log with timestamp, status code,
   and response time for each delivery attempt.

---

### User Story 5 - Pix Automático with QR Code Fallback (Priority: P5)

A developer creates a subscription with Pix Automático enabled. The
end customer receives a consent request in their banking app. If consent
is approved, future billing cycles are debited automatically. If consent
is denied or the customer's bank doesn't support Pix Automático, the
system falls back to generating a QR code for each billing cycle.

**Why this priority**: Pix Automático eliminates friction from recurring
payments — the customer authorizes once and never needs to scan a QR
code again. The fallback ensures no customer is left unable to pay.

**Independent Test**: Create a subscription with Pix Automático,
simulate consent approval, and verify automatic debit on next cycle.
Then simulate consent denial and verify QR code fallback.

**Acceptance Scenarios**:

1. **Given** a subscription created with Pix Automático enabled,
   **When** the subscription is created, **Then** a consent request is
   initiated and a notification is emitted when consent is approved or
   denied.
2. **Given** an approved Pix Automático consent, **When** the billing
   cycle arrives, **Then** the charge is debited automatically without
   generating a QR code.
3. **Given** a denied or unsupported Pix Automático consent, **When**
   the billing cycle arrives, **Then** the system generates a QR code
   as fallback and notifies the developer via webhook.
4. **Given** Pix Automático retries, **When** attempting automatic
   debit, **Then** the system respects the regulatory limit of maximum
   3 retries in 7 days.

---

### User Story 6 - Developer Dashboard and Sandbox (Priority: P6)

A developer logs into a web dashboard to view their business metrics
(MRR, churn rate, active subscriptions), manage entities (customers,
plans, subscriptions, charges), and toggle between sandbox and
production environments. In sandbox, the developer can simulate payments
and accelerate dunning to test the full lifecycle.

**Why this priority**: The dashboard provides visibility without code,
and the sandbox enables safe testing. Both are essential for developer
onboarding and ongoing operations.

**Independent Test**: Log into dashboard, create a sandbox charge,
simulate payment, verify the metrics update. Then toggle to production
view and verify data isolation.

**Acceptance Scenarios**:

1. **Given** a registered developer, **When** they log into the
   dashboard, **Then** they see MRR, churn rate, and active subscription
   count.
2. **Given** the dashboard, **When** the developer views any entity
   (customer, subscription, charge), **Then** a timeline of all events
   related to that entity is displayed.
3. **Given** a sandbox environment, **When** the developer triggers a
   simulated payment on a test charge, **Then** the charge status
   updates and all downstream effects (webhook, subscription state
   change) execute as in production.
4. **Given** sandbox mode, **When** the developer accelerates time,
   **Then** dunning retries execute in minutes instead of days.
5. **Given** a developer with both sandbox and production data, **When**
   they toggle environments, **Then** data is completely isolated —
   sandbox actions never affect production.

---

### User Story 7 - TypeScript SDK and Interactive Documentation (Priority: P7)

A developer installs the official TypeScript SDK from npm, reads the
quickstart guide, and integrates billing into their application with
full type safety. The documentation includes working code examples for
every operation and an interactive API playground.

**Why this priority**: The SDK and docs are the primary interface for
developers. Poor DX here means developers abandon the product regardless
of how good the backend is.

**Independent Test**: Install the SDK, follow the quickstart, and
complete a charge creation with full autocomplete and type checking.

**Acceptance Scenarios**:

1. **Given** an installed SDK, **When** the developer initializes the
   client and calls any method, **Then** full TypeScript autocomplete
   shows available methods, parameters, and return types.
2. **Given** an API error, **When** the SDK throws, **Then** the error
   is typed (validation, authentication, not found, rate limit) with
   an actionable message.
3. **Given** the quickstart guide, **When** a developer follows it from
   start to finish, **Then** they generate their first charge in under
   5 minutes.
4. **Given** the documentation, **When** a developer looks up any
   endpoint, **Then** a working code example is provided that can be
   copied and executed.
5. **Given** the documentation site, **When** a developer visits any
   endpoint reference, **Then** an interactive sandbox allows testing
   the endpoint directly from the browser.

---

### User Story 8 - Pause, Resume, and Refunds (Priority: P8)

A developer can pause a customer's subscription (e.g., for a vacation)
and resume it later. The developer can also process full or partial
refunds on charges. Paused subscriptions generate no charges. When
resumed, the next billing date is recalculated from the resume date.

**Why this priority**: These are common subscription operations that
developers expect but are not critical for initial launch. They enhance
the subscription lifecycle without blocking core functionality.

**Independent Test**: Pause an active subscription, verify no charges
are generated. Resume it and verify the next billing date is correct.
Process a refund and verify the charge status updates.

**Acceptance Scenarios**:

1. **Given** an active subscription, **When** the developer pauses it,
   **Then** the subscription transitions to `paused` and no charges are
   generated during the pause period.
2. **Given** a paused subscription, **When** the developer resumes it,
   **Then** the subscription transitions back to `active` and the next
   billing date is calculated from the resume date.
3. **Given** a paid charge, **When** the developer requests a full
   refund, **Then** the charge status changes to `refunded` and the
   refund is processed via PIX to the original payer.
4. **Given** a paid charge, **When** the developer requests a partial
   refund with a specific amount, **Then** the specified amount is
   refunded and the charge status reflects the partial refund.

---

### User Story 9 - MCP Server for AI Agents (Priority: P9)

An AI agent can manage billing operations (create charges, manage
subscriptions) through an MCP server. Every action taken by the agent
is logged with agent identification, timestamp, and full input/output
for audit purposes. A human operator can review the agent's actions
in the dashboard.

**Why this priority**: AI agents are a growing integration pattern but
not a launch requirement. The audit trail makes this safe for financial
operations.

**Independent Test**: Use an MCP client to create a charge via the
server, verify the charge is created, and verify the action appears
in the audit trail.

**Acceptance Scenarios**:

1. **Given** an MCP server connected with an API key, **When** an agent
   calls `create_charge`, **Then** a charge is created and returned
   with full details.
2. **Given** any agent action, **When** the action completes, **Then**
   an audit log entry is created with agent identifier, timestamp,
   operation name, input, and output.
3. **Given** an operator viewing the dashboard, **When** they check the
   event timeline, **Then** agent-initiated actions are clearly
   distinguishable from human-initiated ones.

---

### Edge Cases

- What happens when a developer tries to delete a customer who has an
  active subscription? The system MUST reject with a clear error
  (conflict) explaining why.
- What happens when a subscription transitions through an invalid state
  change (e.g., `canceled` → `active`)? The system MUST return a
  structured error with the current state, attempted transition, and
  valid transitions.
- What happens when a charge amount is below the minimum (R$ 1.00 /
  100 centavos)? The system MUST reject with a validation error
  specifying the minimum.
- What happens when a webhook endpoint is unreachable for all 5 retry
  attempts? The delivery is marked as `failed` and visible in the
  dashboard delivery log.
- What happens when a Pix Automático consent is approved but the bank
  later revokes it? The system falls back to QR code generation for
  the next billing cycle and notifies the developer via webhook.
- What happens when two requests arrive simultaneously with the same
  idempotency key? Only one charge is created; the second request
  returns the result of the first.
- What happens when a plan is archived while subscriptions are active
  on it? Existing subscriptions continue billing normally; no new
  subscriptions can be created on that plan.

## Requirements *(mandatory)*

### Functional Requirements

**Charges**

- **FR-001**: System MUST allow developers to create one-time PIX
  charges with a QR code, QR code image URL, and copy-paste string.
- **FR-002**: System MUST support configurable charge expiration
  (default 1 hour, maximum 24 hours).
- **FR-003**: System MUST enforce a minimum charge amount of R$ 1.00
  (100 centavos).
- **FR-004**: System MUST support idempotency keys on charge creation
  to prevent duplicate charges.

**Customers**

- **FR-005**: System MUST allow creating customers with name, email,
  and tax ID (CPF or CNPJ).
- **FR-006**: System MUST validate CPF and CNPJ using the official
  check-digit algorithm, returning an actionable error with expected
  format on failure.
- **FR-007**: System MUST enforce email uniqueness per developer
  account.
- **FR-007b**: System MUST enforce tax ID (CPF/CNPJ) uniqueness per
  developer account — the same tax ID cannot appear on two customer
  records within the same account.
- **FR-008**: System MUST prevent deletion of customers with active
  subscriptions (return conflict error).

**Plans**

- **FR-009**: System MUST allow creating subscription plans with name,
  amount (in centavos), billing interval (week, month, year), and
  optional trial days.
- **FR-010**: Plans MUST be immutable after creation — developers
  create a new plan to change pricing.
- **FR-011**: Plans MUST support archival (soft delete) — archived
  plans cannot accept new subscriptions but existing subscriptions
  continue.

**Subscriptions**

- **FR-012**: System MUST implement a subscription state machine with
  states: `trialing`, `active`, `past_due`, `canceled`, `paused`.
- **FR-013**: System MUST validate all state transitions and reject
  invalid ones with a structured error listing valid transitions.
- **FR-014**: Every state transition MUST produce an immutable event
  and trigger a webhook delivery (see FR-049 for general immutability rule).
- **FR-015**: System MUST support `cancel_at_period_end` — maintaining
  access until the current billing period ends.
- **FR-016**: System MUST automatically generate billing cycle charges
  for active subscriptions on their due date.

**Trial Periods**

- **FR-017**: Subscriptions to plans with trial days MUST start in
  `trialing` status with no charge until the trial expires.
- **FR-018**: When a trial expires, the subscription MUST automatically
  transition to `active` and generate the first charge.

**Dunning**

- **FR-019**: When a billing cycle charge fails, the subscription MUST
  transition to `past_due` and the system MUST schedule retry attempts
  at D+1, D+3, and D+7.
- **FR-020**: If a retry succeeds, the subscription MUST transition
  back to `active`.
- **FR-021**: If all retries are exhausted, the subscription MUST
  transition to `canceled` with reason `dunning_failed`.
- **FR-022**: Dunning retry schedule MUST be configurable per plan.

**Pix Automático**

- **FR-023**: System MUST support initiating Pix Automático consent
  flow when creating a subscription.
- **FR-024**: If consent is denied or the customer's bank does not
  support Pix Automático, the system MUST automatically fall back to
  QR code generation for each billing cycle.
- **FR-025**: System MUST respect the regulatory limit of maximum 3
  retries in 7 days for Pix Automático.

**Webhooks**

- **FR-026**: System MUST allow developers to register webhook endpoint
  URLs with an optional list of event types to subscribe to. If no
  event types are specified, the endpoint receives all events.
- **FR-027**: Every billing event MUST be delivered as a signed payload
  (HMAC-SHA256) only to endpoints subscribed to that event type.
- **FR-028**: Failed webhook deliveries MUST be retried with
  exponential backoff: 1min, 5min, 30min, 2h, 24h (5 attempts).
- **FR-029**: Webhook payloads MUST include the full entity snapshot,
  not just identifiers.
- **FR-030**: Each event MUST have a unique identifier; the same event
  MUST NOT be delivered twice.

**Authentication & Security**

- **FR-031**: System MUST authenticate developers via API keys in the
  Authorization header.
- **FR-032**: API keys MUST be prefixed (`fio_test_` for sandbox,
  `fio_live_` for production) and hashed at rest.
- **FR-033**: Sandbox and production data MUST be completely isolated.
- **FR-034**: System MUST never log PII (CPF/CNPJ, email) in plain
  text.

**Sandbox**

- **FR-035**: System MUST provide a sandbox environment where charges
  can be simulated as paid without real money.
- **FR-036**: Sandbox MUST support accelerated dunning (minutes instead
  of days) for testing.
- **FR-037**: Sandbox MUST support separate webhook endpoint
  configuration.

**Dashboard**

- **FR-038**: System MUST provide a web dashboard with developer
  registration and login.
- **FR-039**: Dashboard MUST display MRR, churn rate, and active
  subscription count.
- **FR-040**: Dashboard MUST provide paginated listings of customers,
  charges, subscriptions, and invoices with event timelines.
- **FR-041**: Dashboard MUST show webhook delivery logs with status
  and response details.
- **FR-042**: Dashboard MUST allow generating and rotating API keys
  for both sandbox and production. When a key is rotated, both old and
  new keys MUST remain valid for a 24-hour grace period, after which
  the old key is automatically revoked.

**SDK**

- **FR-043**: System MUST provide a TypeScript SDK with full type
  definitions for all entities and operations.
- **FR-044**: SDK MUST provide typed error classes for each error
  category (validation, authentication, not found, rate limit).
- **FR-045**: SDK MUST include a webhook signature verification helper.

**Documentation**

- **FR-046**: System MUST provide a quickstart guide that enables a
  developer to generate their first charge in under 5 minutes.
- **FR-047**: Documentation MUST include working code examples for
  every endpoint.
- **FR-047b**: All developer-facing documentation MUST be written in
  Portuguese. API error messages and API field names MUST be in English.
- **FR-048**: System MUST publish a machine-readable API specification.

**Event Log**

- **FR-049**: Every state change MUST produce an immutable event in an
  append-only log.
- **FR-050**: Events MUST NOT be updated or deleted. Corrections MUST
  be modeled as compensating events.

**Refunds (P8)**

- **FR-051**: System MUST support full and partial refunds on paid
  charges via the API.

**Pause/Resume (P8)**

- **FR-052**: System MUST allow pausing active subscriptions — paused
  subscriptions generate no charges.
- **FR-053**: System MUST allow resuming paused subscriptions with the
  next billing date recalculated from the resume date.

**MCP Server (P9)**

- **FR-054**: System MUST provide an MCP server with tools for charge
  creation, subscription management, and querying.
- **FR-055**: Every MCP action MUST be logged with agent identifier,
  timestamp, operation, input, and output.

**API Conventions**

- **FR-056**: All API responses MUST use cursor-based pagination.
- **FR-057**: All errors MUST be structured with `type`, `message`,
  `code`, and `details` fields.
- **FR-058**: All timestamps MUST be in ISO 8601 UTC format.
- **FR-059**: All monetary values MUST be integers in centavos.
- **FR-060**: Rate limiting MUST be enforced with limit and remaining
  count communicated in response headers.

### Key Entities

- **Account**: A developer's account on Fio. Owns API keys, customers,
  plans, subscriptions, and charges. All data is scoped by account.
- **Customer**: An end user of the developer's product. Has name, email,
  and tax ID (CPF or CNPJ). Can have subscriptions and charges.
- **Plan**: A subscription template defining name, price (centavos),
  billing interval, trial days, and accepted payment methods. Immutable
  after creation; can be archived.
- **Subscription**: Links a customer to a plan. Has a lifecycle managed
  by a state machine (trialing → active → past_due → canceled; active
  ↔ paused). Tracks billing periods and generates invoices.
- **Invoice**: Represents a single billing cycle for a subscription.
  Links to the subscription and the generated charge. Tracks payment
  status.
- **Charge**: A single PIX payment request. Contains QR code data,
  amount, status, and expiration. Can exist standalone (one-time) or
  linked to an invoice (subscription).
- **Event**: An immutable record of a state change. Stored in an
  append-only log. Contains a snapshot of the entity at the time of
  the event. Triggers webhook delivery.
- **Webhook Endpoint**: A URL registered by the developer to receive
  event notifications. Has a signing secret for HMAC verification.
- **Webhook Delivery**: A record of an attempt to deliver an event to
  a webhook endpoint. Tracks attempts, status, and response.

### Assumptions

- The PSP (Efí Pay) account setup and API credentials are available
  before development begins.
- Pix Automático sandbox access from the PSP is available for
  development; if not, the feature will be developed against a mock
  and integrated when available.
- The regulatory model (Fio as a platform using a PSP as direct
  participant) does not require Fio to hold a R$ 5M patrimônio
  líquido.
- Pricing for paid tiers will be defined post-launch based on unit
  economics — the MVP launches with a free tier.
- Dashboard authentication uses email + password. Magic link login is
  deferred to post-MVP.
- Proration on plan upgrades/downgrades is out of scope — changes
  apply on the next billing cycle.
- Usage-based billing, invoice PDF generation, split billing, and
  NF-e automation are all out of scope for this version.

## Clarifications

### Session 2026-03-04

- Q: Should a customer's tax ID (CPF/CNPJ) be unique within a developer's account? → A: Yes, tax ID is unique per account (same CPF cannot appear twice under one developer).
- Q: Should API error messages and documentation be in English or Portuguese? → A: API errors in English, documentation in Portuguese.
- Q: Should webhook endpoints support filtering by event type? → A: Yes, developers can specify which event types each endpoint receives at registration time.
- Q: When a developer rotates their API key, should the old key stop working immediately? → A: No, both keys are valid for a 24-hour grace period after rotation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from account creation to first
  generated charge in under 5 minutes following the quickstart guide.
- **SC-002**: A developer can set up a complete subscription lifecycle
  (plan + customer + subscription + payment + webhook) in under 30
  minutes.
- **SC-003**: The dunning system recovers more than 30% of initially
  failed charges through automatic retries.
- **SC-004**: 40% of registered developers complete at least one test
  charge in the sandbox.
- **SC-005**: 95% of webhook deliveries succeed on the first attempt
  (excluding developer endpoint errors).
- **SC-006**: The system processes R$ 100K/month in total charge volume
  by month 3.
- **SC-007**: 20 developers have at least one live (production) charge
  within 60 days of launch.
- **SC-008**: NPS among developers who completed integration exceeds 60.
- **SC-009**: Less than 5% of API requests result in client or server
  errors (4xx/5xx).
- **SC-010**: A second developer (not the founder) can complete the
  full integration using only the documentation, without assistance.
