# Tasks: Subscription Billing MVP for PIX

**Input**: Design documents from `/specs/001-subscription-billing-mvp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per constitution principle IX (Test-First for Billing). State machine transitions, dunning scenarios, and webhook delivery paths MUST be tested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **API**: `packages/api/src/`, `packages/api/tests/`
- **Dashboard**: `packages/dashboard/src/`
- **SDK**: `packages/sdk/src/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup

**Purpose**: Monorepo initialization, tooling, and project scaffolding

- [x] T001 Initialize pnpm workspace monorepo with `pnpm-workspace.yaml` defining packages/api, packages/dashboard, packages/sdk, packages/shared, packages/docs
- [x] T002 Configure root TypeScript with `tsconfig.base.json` (strict mode, no `any`, composite project references) and per-package `tsconfig.json` extending base
- [x] T003 [P] Configure Vitest at root with workspace support in `vitest.config.ts`
- [x] T004 [P] Configure ESLint + Prettier at root (TypeScript strict rules, no `any` enforcement) in `eslint.config.mjs` and `.prettierrc`
- [x] T005 [P] Create `packages/shared/src/constants.ts` with status enums (subscription states, charge states, invoice states, event types, payment methods)
- [x] T006 [P] Create `packages/shared/src/types/index.ts` with shared entity TypeScript interfaces (Account, Customer, Plan, Subscription, Invoice, Charge, Event)
- [x] T007 [P] Create `packages/shared/src/schemas/index.ts` with shared Zod schemas for all entities (reusable by API validation and SDK types)
- [x] T008 Create `packages/api/src/app.ts` with Fastify app setup: register `@fastify/cors`, `@fastify/type-provider-zod`, error handler plugin, and route prefix `/v1`

**Checkpoint**: Monorepo builds, TypeScript compiles, Vitest runs empty suite, shared package exports types/schemas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create Kysely database connection in `packages/api/src/db/connection.ts` with PostgreSQL pool config, environment-aware (test uses rollback transactions)
- [x] T010 Create Kysely type definitions in `packages/api/src/db/types.ts` matching all tables from data-model.md (accounts, api_keys, customers, plans, subscriptions, invoices, charges, events, webhook_endpoints, webhook_deliveries, idempotency_keys)
- [x] T011 Create initial database migration `packages/api/src/db/migrations/001-initial-schema.ts` implementing all tables from data-model.md with indexes, constraints, and CHECK clauses
- [x] T012 Implement API key authentication middleware in `packages/api/src/middleware/auth.ts` — extract Bearer token, lookup by key_prefix, verify argon2 hash, inject account_id + environment into request context, reject expired/revoked keys
- [x] T013 [P] Implement structured error handler in `packages/api/src/lib/errors.ts` — define FioError base class and subtypes (ValidationError, AuthError, NotFoundError, ConflictError, RateLimitError, StateTransitionError), Fastify error handler plugin that formats errors per API contract
- [x] T014 [P] Implement rate limiting middleware in `packages/api/src/middleware/rate-limit.ts` using `@fastify/rate-limit` with Redis store, per-API-key limits, `X-RateLimit-*` headers
- [x] T015 [P] Implement idempotency middleware in `packages/api/src/middleware/idempotency.ts` — check `Idempotency-Key` header on POST/PUT, store response in idempotency_keys table with 24h TTL, replay stored response on duplicate
- [x] T016 [P] Implement cursor-based pagination helper in `packages/api/src/lib/pagination.ts` — accept `starting_after` + `limit` params, return `{ data, has_more, next_cursor }` format
- [x] T017 [P] Implement CPF/CNPJ validation in `packages/api/src/lib/cpf-cnpj.ts` — check-digit algorithm for both formats, format/unformat helpers, actionable error messages with expected format
- [x] T018 [P] Implement money utility in `packages/api/src/lib/money.ts` — centavos-to-decimal and decimal-to-centavos conversion for Efí API boundary, validation that amounts are positive integers
- [x] T019 [P] Implement PII masking utility in `packages/api/src/lib/pii-mask.ts` — mask CPF (***.***.789-09), CNPJ, and email in log output
- [x] T020 [P] Implement API key generation in `packages/api/src/lib/api-keys.ts` — generate `fio_test_` / `fio_live_` prefixed keys, argon2 hashing, prefix extraction for lookup
- [x] T021 [P] Implement HMAC-SHA256 signing utility in `packages/api/src/lib/hmac.ts` — sign webhook payloads, generate `Fio-Signature` header value (`t={timestamp},v1={signature}`), verify helper
- [x] T022 Create event service in `packages/api/src/services/event-service.ts` — insert event into append-only events table with entity snapshot, return created event (webhook dispatching added in T065)
- [x] T121 [P] Create event query functions in `packages/api/src/db/queries/events.ts` — insert, findById, listByEntityId, listByType, listWithCursor (used by event service T022 and metrics T080)
- [x] T023 Create BullMQ queue setup in `packages/api/src/jobs/queue-setup.ts` — define queues (billing-cycle, dunning-retry, webhook-delivery, pix-automatico-consent, charge-expiration), Redis connection, shared job options
- [x] T024 Create test helpers in `packages/api/tests/helpers/setup.ts` — test database setup with transaction rollback, Fastify app factory for inject tests, fixture factories for accounts/api-keys/customers
- [x] T025 Write unit tests for CPF/CNPJ validation in `packages/api/tests/unit/lib/cpf-cnpj.test.ts` — valid CPF, invalid CPF, valid CNPJ, invalid CNPJ, format/unformat
- [x] T026 [P] Write unit tests for money utilities in `packages/api/tests/unit/lib/money.test.ts` — centavos conversion, reject floats, reject negative, boundary values

**Checkpoint**: Foundation ready — database migrates, auth works, errors are structured, middleware chain functional. User story implementation can begin.

---

## Phase 3: User Story 1 — First PIX Charge in 5 Minutes (Priority: P1) MVP

**Goal**: Developer creates a customer with CPF/CNPJ and generates a one-time PIX charge with QR code.

**Independent Test**: Create customer → create charge → verify QR code returned → simulate payment → verify status updates to `paid`.

### Tests for User Story 1

- [x] T027 [P] [US1] Write integration tests for customer CRUD in `packages/api/tests/integration/routes/customers.test.ts` — create with valid CPF, reject invalid CPF, reject duplicate email, reject duplicate tax_id, delete without active subscriptions, reject delete with active subscription
- [x] T028 [P] [US1] Write integration tests for charge creation in `packages/api/tests/integration/routes/charges.test.ts` — create with QR code returned, enforce minimum amount, idempotency key dedup, expiration default/custom, reject expired charge query
- [x] T115 [P] [US1] Write unit tests for charge state machine in `packages/api/tests/unit/domain/charge-state-machine.test.ts` — all valid transitions (pending→paid, pending→failed, pending→expired, paid→refunded, paid→partially_refunded), invalid transitions (expired→paid, refunded→pending, etc.), event emission on each transition

### Implementation for User Story 1

- [x] T029 [P] [US1] Create PaymentProvider interface in `packages/api/src/providers/payment-provider.ts` — define methods: createPixCharge(amount, txid, expiration, pixKey) → { qrCode, qrCodeImage, copyPaste, providerRef }, getChargeStatus(providerRef), refund(endToEndId, amount)
- [x] T030 [P] [US1] Create MockPaymentProvider in `packages/api/src/providers/mock-provider.ts` — implement PaymentProvider with in-memory state, generate fake QR codes, support simulated payment status changes
- [x] T116 [US1] Create charge state machine in `packages/api/src/domain/charge-state-machine.ts` — define valid transitions map (6 states: pending, paid, failed, expired, refunded, partially_refunded), validate transition, emit event on success, return 422 with current state + valid transitions on invalid
- [x] T031 [US1] Create customer service in `packages/api/src/services/customer-service.ts` — create (validate CPF/CNPJ, enforce email+tax_id uniqueness per account+env), get, update (tax_id immutable), delete (reject if active subscriptions), list (cursor pagination)
- [x] T032 [US1] Create customer query functions in `packages/api/src/db/queries/customers.ts` — insert, findById, findByAccountAndEmail, findByAccountAndTaxId, update, delete, listWithCursor
- [x] T033 [US1] Create customer routes in `packages/api/src/routes/v1/customers.ts` — POST (create), GET /:id, PUT /:id, DELETE /:id, GET (list) with Zod request validation and typed responses
- [x] T034 [US1] Create charge service in `packages/api/src/services/charge-service.ts` — create charge (call PaymentProvider, store QR code data, emit charge.created event), get, list, handle payment callback (update status, emit charge.paid/expired event)
- [x] T035 [US1] Create charge query functions in `packages/api/src/db/queries/charges.ts` — insert, findById, findByProviderRef, updateStatus, listWithCursor
- [x] T036 [US1] Create charge routes in `packages/api/src/routes/v1/charges.ts` — POST (create with idempotency), GET /:id, GET (list) with Zod validation
- [x] T037 [US1] Create Efí Pay webhook receiver in `packages/api/src/routes/webhooks/efi-callback.ts` — receive Efí PIX payment notifications, iterate pix[] array, match by provider_reference (txid), store endToEndId, update charge status, emit events
- [x] T038 [US1] Create Efí Pay provider in `packages/api/src/providers/efi-provider.ts` — implement PaymentProvider with mTLS + OAuth2 auth, token caching (3500s), PIX Cobrança creation (PUT /v2/cob/{txid}), QR code retrieval (GET /v2/loc/{id}/qrcode), decimal-to-centavos conversion at boundary
- [x] T039 [US1] Create server entry point in `packages/api/src/server.ts` — start Fastify, run migrations, register all routes and middleware, graceful shutdown
- [x] T119 [US1] Create charge expiration job in `packages/api/src/jobs/charge-expiration.ts` — BullMQ repeatable job (every 5 min), query charges WHERE expires_at <= now() AND status = 'pending', transition to expired via charge state machine, emit charge.expired events

**Checkpoint**: Developer can create customer + charge via API, get QR code. In sandbox (mock provider), simulated payments update charge status. Events emitted for charge.created and charge.paid.

---

## Phase 4: User Story 2 — Subscription with Automatic Billing Cycles (Priority: P2)

**Goal**: Developer creates plans, subscribes customers, and billing cycle charges are generated automatically.

**Independent Test**: Create plan → subscribe customer → advance billing cycle → verify new charge auto-generated with invoice.

### Tests for User Story 2

- [x] T040 [P] [US2] Write unit tests for subscription state machine in `packages/api/tests/unit/domain/subscription-state-machine.test.ts` — all valid transitions (trialing→active, active→past_due, active→canceled, active→paused, past_due→active, past_due→canceled, paused→active, paused→canceled), all invalid transitions (canceled→active, trialing→paused, etc.), event emission on each transition
- [x] T041 [P] [US2] Write integration tests for subscription creation and billing cycle in `packages/api/tests/integration/routes/subscriptions.test.ts` — create with trial (status=trialing), create without trial (status=active, charge generated), query with invoices, cancel immediately, cancel at period end
- [x] T117 [P] [US2] Write unit tests for invoice state machine in `packages/api/tests/unit/domain/invoice-state-machine.test.ts` — all valid transitions (draft→open, open→paid, open→failed, open→void), invalid transitions, event emission on each transition

### Implementation for User Story 2

- [x] T042 [US2] Create subscription state machine in `packages/api/src/domain/subscription-state-machine.ts` — define valid transitions map, validate transition, emit event on success, return 422 with current state + valid transitions on invalid
- [x] T118 [US2] Create invoice state machine in `packages/api/src/domain/invoice-state-machine.ts` — define valid transitions map (5 states: draft, open, paid, failed, void), validate transition, emit event on success, return 422 on invalid
- [x] T043 [P] [US2] Create plan service in `packages/api/src/services/plan-service.ts` — create (validate amount >= 100, interval enum), get, list, archive (soft delete), reject modification after creation
- [x] T044 [P] [US2] Create plan query functions in `packages/api/src/db/queries/plans.ts` — insert, findById, archive, listWithCursor (filter by active)
- [x] T045 [P] [US2] Create plan routes in `packages/api/src/routes/v1/plans.ts` — POST, GET /:id, DELETE /:id (archive), GET (list)
- [x] T046 [US2] Create invoice query functions in `packages/api/src/db/queries/invoices.ts` — insert, findById, findBySubscription, updateStatus, listWithCursor
- [x] T047 [US2] Create subscription service in `packages/api/src/services/subscription-service.ts` — create (determine initial status from trial_days, generate first charge if no trial, create invoice), get (include plan + latest invoice), cancel (immediate or at_period_end), list, advance billing period
- [x] T048 [US2] Create subscription query functions in `packages/api/src/db/queries/subscriptions.ts` — insert, findById, updateStatus, findDueForBilling (current_period_end <= now AND status=active), listWithCursor
- [x] T049 [US2] Create subscription routes in `packages/api/src/routes/v1/subscriptions.ts` — POST, GET /:id, POST /:id/cancel, GET (list with status filter)
- [x] T050 [US2] Create invoice service in `packages/api/src/services/invoice-service.ts` — create invoice for billing cycle (link subscription + charge), update status on charge payment/failure
- [x] T051 [US2] Create invoice routes in `packages/api/src/routes/v1/invoices.ts` — GET /:id, GET (list with subscription_id filter)
- [x] T052 [US2] Implement billing cycle job in `packages/api/src/jobs/billing-cycle.ts` — BullMQ repeatable job (daily), query subscriptions due for billing, create invoice + charge for each, emit events

**Checkpoint**: Plans created, subscriptions active, billing cycle job generates charges automatically. State machine validates all transitions.

---

## Phase 5: User Story 3 — Trial Periods and Smart Dunning (Priority: P3)

**Goal**: Plans with trial days, automatic trial→active conversion, and configurable dunning retry on payment failure.

**Independent Test**: Subscribe with trial → advance past trial → verify auto-activation + charge. Simulate failure → verify retries at D+1, D+3, D+7 → verify cancellation after exhaustion.

### Tests for User Story 3

- [x] T053 [P] [US3] Write integration tests for dunning in `packages/api/tests/integration/services/dunning.test.ts` — retry succeeds (subscription→active), retry fails + next retry scheduled, all retries exhausted (subscription→canceled with dunning_failed), custom dunning schedule from plan

### Implementation for User Story 3

- [x] T054 [US3] Add trial expiration logic to billing cycle job in `packages/api/src/jobs/billing-cycle.ts` — query subscriptions where trial_end <= now AND status=trialing, transition to active, generate first charge
- [x] T055 [US3] Implement dunning retry job in `packages/api/src/jobs/dunning-retry.ts` — BullMQ job triggered on charge failure, read dunning_schedule from plan, schedule next retry (D+1, D+3, D+7 default), create new charge on retry, transition to canceled if all retries exhausted, emit events at each step
- [x] T056 [US3] Update charge service in `packages/api/src/services/charge-service.ts` to handle payment failure — trigger dunning job, transition subscription to past_due on first failure, transition back to active on retry success
- [x] T057 [US3] Add `subscription.trial_ending` event — emit 3 days before trial expiration via billing cycle job check

**Checkpoint**: Trial subscriptions auto-convert. Failed payments retry per schedule. Exhausted retries cancel subscription with `dunning_failed` reason. All dunning paths emit correct events.

---

## Phase 6: User Story 4 — Real-time Webhooks with Verified Delivery (Priority: P4)

**Goal**: Developers register webhook endpoints, receive signed event payloads with retry on failure.

**Independent Test**: Register endpoint → trigger event → verify delivery with valid HMAC signature. Simulate failure → verify exponential backoff retries.

### Tests for User Story 4

- [x] T058 [P] [US4] Write integration tests for webhook delivery in `packages/api/tests/integration/jobs/webhook-delivery.test.ts` — successful delivery, failed delivery with retry scheduling (1min, 5min, 30min, 2h, 24h), max retries exhausted (status=failed), HMAC signature verification, event type filtering (endpoint only receives subscribed types)

### Implementation for User Story 4

- [x] T059 [P] [US4] Create webhook endpoint query functions in `packages/api/src/db/queries/webhook-endpoints.ts` — insert (generate secret), findById, findActiveByAccountAndEnvironment, findMatchingEventType, delete, listWithCursor
- [x] T060 [P] [US4] Create webhook delivery query functions in `packages/api/src/db/queries/webhook-deliveries.ts` — insert, findById, updateAttempt, findPendingRetries, listWithCursor
- [x] T061 [US4] Create webhook service in `packages/api/src/services/webhook-service.ts` — register endpoint (with optional event_types filter), deliver event to matching endpoints, record delivery attempt
- [x] T062 [US4] Create webhook endpoint routes in `packages/api/src/routes/v1/webhook-endpoints.ts` — POST (create, return secret once), GET (list), DELETE /:id
- [x] T063 [US4] Create webhook delivery routes in `packages/api/src/routes/v1/webhook-deliveries.ts` — GET (list with filters: endpoint_id, event_id, status)
- [x] T064 [US4] Implement webhook delivery job in `packages/api/src/jobs/webhook-delivery.ts` — BullMQ job, POST payload to endpoint URL with Fio-Signature header, 10s timeout, record response (status code, body truncated to 1KB, response time), schedule retry with exponential backoff on failure
- [x] T065 [US4] Update event service in `packages/api/src/services/event-service.ts` to query matching webhook endpoints (by event_type filter) and enqueue webhook-delivery jobs for each

**Checkpoint**: Webhook endpoints registered with event type filtering. Events delivered with HMAC signature. Failed deliveries retry with backoff. Delivery log visible via API.

---

## Phase 7: User Story 5 — Pix Automático with QR Code Fallback (Priority: P5)

**Goal**: Subscriptions can use Pix Automático for automatic debit, with QR code fallback on consent denial.

**Independent Test**: Create subscription with pix_automatico=true → simulate consent approval → advance cycle → verify automatic debit. Simulate denial → verify QR code fallback.

### Implementation for User Story 5

- [x] T066 [US5] Add Pix Automático methods to PaymentProvider interface in `packages/api/src/providers/payment-provider.ts` — createConsentRequest(customer, amount, interval), getConsentStatus(consentId), createAutomaticCharge(consentId, amount, scheduledDate)
- [x] T067 [US5] Implement Pix Automático in Efí provider in `packages/api/src/providers/efi-provider.ts` — POST /v2/gn/automatico/consentimento, GET consent status, POST /v2/gn/automatico/cobranca, respect 48h advance notice, max 3 retries/7 days
- [x] T068 [US5] Implement Pix Automático consent polling job in `packages/api/src/jobs/pix-automatico-consent.ts` — poll consent status, update customer.pix_automatico_consent_status, emit pix_automatico.consent_approved/denied events
- [x] T069 [US5] Update subscription service in `packages/api/src/services/subscription-service.ts` to initiate consent flow when pix_automatico=true on creation
- [x] T070 [US5] Update billing cycle job in `packages/api/src/jobs/billing-cycle.ts` — for subscriptions with approved Pix Automático consent, execute automatic debit instead of QR code; on consent denied/unavailable, fall back to QR code generation
- [x] T071 [US5] Update MockPaymentProvider in `packages/api/src/providers/mock-provider.ts` to support consent simulation (approve/deny/pending states)

**Checkpoint**: Pix Automático consent flow works end-to-end. Automatic debits execute for approved consents. QR code fallback works when consent is denied.

---

## Phase 8: User Story 6 — Developer Dashboard and Sandbox (Priority: P6)

**Goal**: Web dashboard for metrics, entity management, API key rotation, and sandbox simulation.

**Independent Test**: Register → login → view dashboard → create sandbox charge → simulate payment → verify metrics update. Toggle to production → verify data isolation.

### Implementation for User Story 6

- [x] T072 [US6] Initialize Next.js 15 app in `packages/dashboard/` with App Router, TypeScript, Tailwind CSS
- [x] T073 [US6] Implement dashboard auth pages in `packages/dashboard/src/app/(auth)/` — register (email + password), login (email + password), session management
- [x] T074 [US6] Implement account service in `packages/api/src/services/account-service.ts` — register (hash password with argon2, generate initial test+live API keys), login (verify password, return session token)
- [x] T075 [US6] Implement dashboard API key management in `packages/dashboard/src/app/(dashboard)/settings/page.tsx` — list keys (show prefix only), generate new key (show full key once), rotate key (24h grace period), toggle sandbox/live
- [x] T076 [US6] Implement metrics service in `packages/api/src/services/metrics-service.ts` — calculate MRR (sum of active subscription amounts normalized to monthly), churn rate (canceled in last 30 days / total active at period start), active subscription count
- [x] T077 [US6] Create metrics route in `packages/api/src/routes/v1/metrics.ts` — GET /v1/metrics returning { mrr, active_subscriptions, churn_rate, churn_period_days }
- [x] T078 [US6] Implement dashboard overview page in `packages/dashboard/src/app/(dashboard)/overview/page.tsx` — display MRR, churn rate, active subscriptions cards
- [x] T079 [US6] Implement dashboard entity listing pages in `packages/dashboard/src/app/(dashboard)/` — customers/, subscriptions/, charges/ pages with paginated tables, click-through to detail views with event timeline
- [x] T080 [US6] Implement dashboard webhook log page in `packages/dashboard/src/app/(dashboard)/webhooks/page.tsx` — list webhook deliveries with status, response code, response time, endpoint URL
- [x] T081 [US6] Create sandbox simulation endpoints in `packages/api/src/routes/v1/test.ts` — POST /v1/test/charges/:id/pay (simulate payment, trigger full event chain), POST /v1/test/time/advance (advance sandbox time, trigger billing cycles + dunning retries at accelerated pace)

**Checkpoint**: Dashboard shows metrics, lists entities with event timelines, manages API keys. Sandbox simulation endpoints trigger full billing lifecycle.

---

## Phase 9: User Story 7 — TypeScript SDK and Interactive Documentation (Priority: P7)

**Goal**: Published npm SDK with full types and Portuguese documentation with interactive playground.

**Independent Test**: npm install @fio-pay/sdk → initialize client → create customer + charge → verify full autocomplete in IDE.

### Implementation for User Story 7

- [x] T082 [US7] Create SDK client in `packages/sdk/src/client.ts` — Fio class constructor (apiKey), base HTTP client with auth header, environment detection from key prefix, structured error parsing
- [x] T083 [US7] Create SDK resource classes in `packages/sdk/src/resources/` — customers.ts, plans.ts, subscriptions.ts, charges.ts, invoices.ts, webhook-endpoints.ts — each with CRUD methods, full TypeScript generics for request/response types
- [x] T084 [US7] Create SDK error types in `packages/sdk/src/errors.ts` — FioError (base), FioValidationError (422), FioAuthError (401), FioNotFoundError (404), FioRateLimitError (429), FioConflictError (409)
- [x] T085 [US7] Create SDK webhook verification in `packages/sdk/src/webhooks.ts` — Fio.webhooks.verify(rawBody, signature, secret) with timestamp validation (reject > 300s), typed event return
- [x] T086 [US7] Create SDK entry point in `packages/sdk/src/index.ts` — export Fio client, all types, all error classes, configure package.json for npm publishing (@fio-pay/sdk, MIT license)
- [x] T087 [US7] Write SDK tests in `packages/sdk/tests/` — client initialization, each resource method, error parsing, webhook verification (valid signature, expired timestamp, invalid signature)
- [x] T120 [US7] Create SDK test resource in `packages/sdk/src/resources/test.ts` — simulatePayment(chargeId) mapping to POST /v1/test/charges/:id/pay, advanceTime(days) mapping to POST /v1/test/time/advance, only available when SDK detects test key prefix
- [x] T088 [US7] Initialize Fumadocs app in `packages/docs/` — Next.js-based docs site with MDX support
- [x] T089 [US7] Write quickstart guide in Portuguese in `packages/docs/content/quickstart.mdx` — "Primeira cobrança PIX em 5 minutos" following quickstart.md from specs
- [x] T090 [US7] Write subscription guide in Portuguese in `packages/docs/content/guides/subscription-billing.mdx` — full subscription lifecycle setup in 30 minutes
- [x] T091 [US7] Write API reference pages in `packages/docs/content/api/` — one page per resource (customers, plans, subscriptions, charges, invoices, webhooks) with request/response examples from contracts/api-v1.md
- [x] T092 [US7] Write webhook events reference in `packages/docs/content/webhooks.mdx` — all event types with example payloads from contracts/webhook-events.md
- [x] T093 [US7] Generate and publish OpenAPI spec from Fastify routes in `packages/api/src/openapi.ts` using `@fastify/swagger` — serve at /v1/openapi.json

**Checkpoint**: SDK installs from npm, full autocomplete works. Docs site live with quickstart, guides, API reference, webhook reference. OpenAPI spec published.

---

## Phase 10: User Story 8 — Pause, Resume, and Refunds (Priority: P8)

**Goal**: Developers can pause/resume subscriptions and process full/partial refunds.

**Independent Test**: Pause active subscription → verify no charges generated → resume → verify new billing date. Refund a paid charge → verify status update.

### Implementation for User Story 8

- [x] T094 [US8] Add pause and resume routes in `packages/api/src/routes/v1/subscriptions.ts` — POST /:id/pause (validate active→paused), POST /:id/resume (validate paused→active, recalculate current_period_end from now)
- [x] T095 [US8] Add pause/resume routes integration with subscription state machine — verify active→paused and paused→active transitions (already defined in T042) emit events correctly from route handlers in `packages/api/src/routes/v1/subscriptions.ts`
- [x] T096 [US8] Implement refund in charge service in `packages/api/src/services/charge-service.ts` — full refund (status→refunded) and partial refund (status→partially_refunded, track refunded_amount), call PaymentProvider.refund(endToEndId, amount)
- [x] T097 [US8] Add refund route in `packages/api/src/routes/v1/charges.ts` — POST /:id/refund (optional amount param), validate charge is paid, validate refund doesn't exceed paid amount
- [x] T098 [US8] Implement refund in Efí provider in `packages/api/src/providers/efi-provider.ts` — PUT /v2/pix/{endToEndId}/devolucao/{refundId}, handle partial/full refund, convert centavos to decimal string
- [x] T099 [US8] Update SDK resources in `packages/sdk/src/resources/` — add subscriptions.pause(), subscriptions.resume(), charges.refund(id, { amount? }) methods

**Checkpoint**: Pause/resume works with correct state transitions. Refunds process via Efí Pay. SDK methods available.

---

## Phase 11: User Story 9 — MCP Server for AI Agents (Priority: P9)

**Goal**: MCP server with billing tools and audit trail for agent actions.

**Independent Test**: Connect MCP client → call create_charge tool → verify charge created and audit log entry recorded.

### Implementation for User Story 9

- [x] T100 [US9] Create MCP server as separate repository (`fio-mcp-server`) with TypeScript setup, MIT license, @fio-pay/sdk as dependency
- [x] T101 [US9] Implement MCP tools in `src/tools/` of fio-mcp-server — create_charge, create_subscription, list_subscriptions, get_subscription, cancel_subscription — each calling Fio API via SDK
- [x] T102 [US9] Implement audit logging in `src/audit.ts` of fio-mcp-server — log each tool invocation with agent_id (from MCP client info), timestamp, tool name, input params, output result; pass agent_id as event metadata via SDK
- [x] T103 [US9] Ensure event service accepts metadata.agent_id on event creation (already supported by T022 metadata field) — add dashboard display logic to show agent badge on agent-initiated events in `packages/dashboard/src/components/event-timeline.tsx`

**Checkpoint**: MCP server creates charges and manages subscriptions. All actions logged with agent identification. Dashboard shows agent actions distinctly.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T104 [P] Generate `llms.txt` at docs site root for AI agent discoverability in `packages/docs/public/llms.txt`
- [x] T105 [P] Add request/response logging middleware in `packages/api/src/middleware/logger.ts` — structured JSON logs, PII masking, request ID tracking
- [x] T106 [P] Add health check endpoint in `packages/api/src/routes/health.ts` — GET /health returning DB + Redis connectivity status
- [x] T107 Configure Railway deployment in root `railway.toml` — API service, dashboard service, BullMQ worker service, PostgreSQL, Redis
- [x] T108 Run full test suite, verify 90%+ coverage on billing engine (domain/, services/, jobs/), 80%+ overall
- [ ] T109 Run quickstart.md validation end-to-end — follow quickstart from scratch using SDK against sandbox
- [x] T110 [P] Add ESLint rule or CI check enforcing max 300 lines per file per constitution principle X in `eslint.config.mjs`
- [x] T111 [P] Create idempotency key cleanup job in `packages/api/src/jobs/idempotency-cleanup.ts` — BullMQ repeatable job (hourly), delete rows WHERE expires_at < now()
- [x] T112 [P] Create API key auto-revocation job in `packages/api/src/jobs/api-key-revocation.ts` — BullMQ repeatable job (hourly), revoke keys WHERE expires_at IS NOT NULL AND expires_at < now() AND revoked_at IS NULL
- [ ] T113 Load test API with `autocannon` in `packages/api/tests/load/` — target 100 req/s sustained, <200ms p95 latency on charge creation and customer listing endpoints
- [x] T114 Create CI job to validate documentation code examples against sandbox — run quickstart.md and API reference snippets end-to-end in `packages/docs/tests/examples.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 (charges + customers required)
- **US3 (Phase 5)**: Depends on US2 (subscriptions + billing cycle required)
- **US4 (Phase 6)**: Depends on US1 (event service required)
- **US5 (Phase 7)**: Depends on US2 + US3 (subscriptions + billing cycle + dunning)
- **US6 (Phase 8)**: Depends on US1 + US2 (API endpoints to display)
- **US7 (Phase 9)**: Depends on US1-US4 (API must be stable for SDK/docs)
- **US8 (Phase 10)**: Depends on US2 (subscription state machine)
- **US9 (Phase 11)**: Depends on US7 (uses SDK)
- **Polish (Phase 12)**: Depends on all user stories

### Parallel Opportunities After Foundation

```
                    ┌── US1 (Phase 3) ──┐
                    │                    ├── US2 (Phase 4) ── US3 (Phase 5) ── US5 (Phase 7)
Foundation ────────┤                    ├── US4 (Phase 6)
                    │                    ├── US6 (Phase 8)
                    │                    └── US8 (Phase 10)
                    │
                    └── (after US1-US4) ── US7 (Phase 9) ── US9 (Phase 11)
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/queries before services
- Services before routes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Examples

```bash
# Phase 2 Foundation — parallel tasks:
T013 (errors), T014 (rate-limit), T015 (idempotency), T016 (pagination),
T017 (cpf-cnpj), T018 (money), T019 (pii-mask), T020 (api-keys), T021 (hmac)

# Phase 3 US1 — parallel tests then parallel implementation:
T027 (customer tests) + T028 (charge tests)
T029 (PaymentProvider interface) + T030 (MockProvider)

# Phase 3 US1 — new state machine tasks:
T115 (charge SM tests) in parallel with T027 + T028
T116 (charge SM) after T115

# Phase 4 US2 — parallel tests then sequential build:
T040 (state machine tests) + T041 (subscription tests) + T117 (invoice SM tests)
T043 (plan service) + T044 (plan queries) in parallel with T046 (invoice queries)
T118 (invoice SM) after T117
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently — customer + charge + QR code + simulated payment
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → First PIX charge works (MVP!)
3. US2 → Subscriptions with automatic billing
4. US3 → Trials + dunning complete the billing engine
5. US4 → Webhooks enable developer reactions
6. US5 → Pix Automático adds frictionless payments
7. US6 → Dashboard gives visibility
8. US7 → SDK + docs make it accessible
9. US8 → Pause/resume + refunds round out the API
10. US9 → MCP server for AI agents
11. Polish → Production readiness

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution requires: 90%+ billing coverage, no floats for money, state machine for all transitions, events for all state changes
