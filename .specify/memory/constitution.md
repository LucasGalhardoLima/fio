<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0 (resolve tech stack alternatives post-research)
  Added principles:
    - I. PSP Abstraction
    - II. Event-Sourced Billing
    - III. Subscription State Machine (NON-NEGOTIABLE)
    - IV. Money Safety (NON-NEGOTIABLE)
    - V. Async Jobs for Side Effects
    - VI. Developer Experience is the Product
    - VII. API Contract Discipline
    - VIII. Security by Default
    - IX. Test-First for Billing
    - X. Strict TypeScript, No Magic
  Added sections:
    - Technical Stack & Constraints
    - Scope Boundaries (What Fio Is NOT)
    - Governance
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no updates needed (generic)
    - .specify/templates/spec-template.md ✅ no updates needed (generic)
    - .specify/templates/tasks-template.md ✅ no updates needed (generic)
    - .specify/templates/checklist-template.md ✅ no updates needed (generic)
    - .specify/templates/agent-file-template.md ✅ no updates needed (generic)
  Follow-up TODOs: none
-->

# Fio Constitution

## Core Principles

### I. PSP Abstraction

The core billing engine MUST never communicate with Efí Pay (or any
PSP) directly. All payment service provider interaction goes through
a `PaymentProvider` interface.

- Adding or swapping a PSP means implementing the interface — business
  logic MUST NOT change.
- PSP credentials MUST be encrypted at rest and never exposed in logs.
- PSP integration tests MUST use a mock `PaymentProvider`; real API
  calls are forbidden in CI.

**Rationale**: Vendor lock-in is a business risk. The abstraction
ensures Fio can add Mercado Pago, Asaas, or any future PSP without
rewriting billing logic.

### II. Event-Sourced Billing

Every state change in the billing domain MUST produce an immutable
event in an append-only `events` table.

- The events table is the source of truth for metrics, audit trail,
  and future analytics.
- Events MUST NOT be updated or deleted. Corrections are modeled as
  compensating events.
- Every event MUST trigger the corresponding webhook delivery job.

**Rationale**: Financial systems require a complete audit trail.
Event sourcing provides this by default and enables replay, debugging,
and analytics without additional infrastructure.

### III. Subscription State Machine (NON-NEGOTIABLE)

The subscription state machine is the heart of Fio. States:
`trialing`, `active`, `past_due`, `canceled`, `paused`.

- Transitions MUST be explicit, validated, and each one MUST emit an
  event and a webhook.
- Invalid transitions MUST return HTTP 422 with a structured error
  explaining the current state and the attempted transition.
- No shortcuts, no implicit state changes, no "just update the status
  field". Every transition goes through the state machine.
- Every state machine transition MUST have a test covering both the
  happy path and the invalid transition case.

**Rationale**: Implicit state changes cause billing errors that
directly cost users money. The state machine makes transitions
auditable and predictable.

### IV. Money Safety (NON-NEGOTIABLE)

All monetary values MUST be represented as integers in BRL centavos.

- Floats MUST NEVER be used for money. Ever.
- Every function that touches money MUST have tests.
- API responses and webhook payloads MUST express amounts as integers
  in centavos.
- The database schema MUST use integer types for monetary columns.

**Rationale**: Floating-point arithmetic produces rounding errors
that compound in billing systems. Centavos as integers eliminate this
class of bug entirely.

### V. Async Jobs for Side Effects

Billing cycle generation, dunning retries, webhook delivery, and
Pix Automático consent polling MUST be BullMQ jobs — never
synchronous API calls.

- Jobs MUST be idempotent — reprocessing the same job MUST NOT
  produce duplicate side effects.
- Job failures MUST be logged with enough context to debug without
  reproducing the failure.
- Webhook delivery MUST retry with exponential backoff: 1min, 5min,
  30min, 2h, 24h (5 attempts).

**Rationale**: Synchronous side effects in API requests create
coupling, increase latency, and make failure handling unpredictable.
Queues provide retry, observability, and backpressure.

### VI. Developer Experience is the Product

DX is not a feature — it is the product. Time to first charge
MUST be under 5 minutes.

- The SDK (`@fio-pay/sdk`) MUST have full TypeScript types —
  autocomplete tells the developer what to do without reading docs.
- Errors MUST be actionable: "Invalid CPF format. Expected:
  123.456.789-00 or 12345678900" — not "Validation error".
- Documentation MUST have working code examples for every endpoint.
  Examples MUST be tested in CI.
- Sandbox MUST simulate the full billing lifecycle including payment
  simulation and accelerated dunning.

**Rationale**: The target user (indie dev / micro-SaaS builder) has
limited time and patience. If integration friction exists, they will
build their own or choose a competitor.

### VII. API Contract Discipline

The API MUST be RESTful, JSON, versioned with a `v1` prefix.

- Pagination: cursor-based (not offset).
- Errors: structured JSON with `type`, `message`, `code`, and
  `details` array.
- Authentication: Bearer token (API key) in `Authorization` header.
- API keys prefixed: `fio_test_` for sandbox, `fio_live_` for
  production.
- All timestamps in ISO 8601 UTC.
- `Idempotency-Key` header required on POST/PUT endpoints. Duplicate
  requests MUST be safe.
- Rate limiting with `X-RateLimit-Limit` and `X-RateLimit-Remaining`
  headers.

**Rationale**: Predictable APIs reduce integration errors. Idempotency
prevents duplicate charges — a billing-critical concern.

### VIII. Security by Default

Security is not optional and MUST NOT be deferred to "later".

- API keys MUST be hashed at rest (argon2 or bcrypt). The full key
  is shown only once at creation.
- Webhook signatures MUST use HMAC-SHA256 via the `Fio-Signature`
  header. The SDK MUST provide a verification helper.
- Sandbox and production data MUST be completely isolated (separate
  schemas or prefixed keys).
- No PII in logs. CPF/CNPJ and email MUST be masked in log output.
- Input sanitization MUST be applied on all user-facing fields.

**Rationale**: Fio handles financial data in a regulated market.
A security incident destroys trust permanently. Defense in depth
from day 1 is cheaper than remediation.

### IX. Test-First for Billing

Billing logic MUST be thoroughly tested. Target: 90%+ coverage on
the billing engine, 80%+ overall.

- Every state machine transition MUST have a test (happy path +
  invalid transition).
- Every dunning scenario MUST have an integration test (retry
  succeeds, retry fails, all retries exhausted → cancel).
- Every webhook delivery path MUST have a test (success, failure,
  retry, max retries).
- Database tests MUST use a real PostgreSQL (not mocks) with test
  transactions that rollback.
- Use Vitest as the test runner.

**Rationale**: Billing bugs cost real money. Mocked databases hide
query bugs. Real database tests catch schema mismatches, constraint
violations, and transaction edge cases.

### X. Strict TypeScript, No Magic

TypeScript strict mode everywhere. No `any`, no `as` casts unless
absolutely necessary with a comment explaining why.

- Functions over classes. Use classes only for the state machine and
  domain entities where it genuinely helps.
- Every public API endpoint MUST have input validation (Zod schemas)
  and typed error responses.
- No ORMs — use raw SQL with a thin query builder (Kysely).
  Billing logic needs predictable queries, not magic.
- Keep files under 300 lines. If a file grows beyond that, split it.

**Rationale**: Strict types catch bugs at compile time. ORMs generate
unpredictable SQL that is dangerous in billing contexts. Small files
force separation of concerns.

## Technical Stack & Constraints

- **Language**: TypeScript (strict mode, no `any`)
- **Runtime**: Node.js 20+
- **API Framework**: Fastify 5
- **Database**: PostgreSQL with JSONB for flexible fields
- **Queue**: BullMQ (Redis) for async jobs
- **Infrastructure**: Railway (São Paulo region)
- **Dashboard**: Next.js 15
- **Documentation**: Fumadocs
- **PSP**: Efí Pay — abstracted behind `PaymentProvider` interface
- **SDK**: `@fio-pay/sdk` published on npm
- **Testing**: Vitest with real PostgreSQL
- **Data model**: Supports `payment_method.type` as enum
  (`pix | card | boleto`) from day 1; only PIX implemented in v1

### Brazilian Regulatory Constraints

- CPF/CNPJ validation MUST be enforced on all customer records.
- Pix Automático consent flow MUST follow Banco Central rules.
- Max 3 retries in 7 days for Pix Automático.
- All amounts in BRL centavos (integer).

### Webhook Contract

- Every state change MUST emit a webhook event.
- Events delivered with HMAC-SHA256 signature in `Fio-Signature`
  header.
- Retry with exponential backoff: 1min, 5min, 30min, 2h, 24h
  (5 attempts).
- Events are idempotent — the same event ID MUST NOT be sent twice.
- Webhook payloads MUST include the full entity snapshot, not just
  IDs.

### Licensing

- SDK and MCP server: MIT licensed (open source).
- Core API: proprietary.

## Scope Boundaries (What Fio Is NOT)

These boundaries MUST be enforced during feature planning and code
review. If a proposed feature falls into any of these categories,
it MUST be rejected or deferred to a future version with explicit
justification.

- **Not a payment gateway**. Fio uses a PSP (Efí Pay) underneath,
  invisible to the developer.
- **Not a bank**. Fio does not custody money.
- **Not an ERP**. No invoicing beyond billing cycle invoices, no
  accounting, no inventory.
- **Not a multi-payment platform (yet)**. V1 is PIX-only. Card and
  boleto come in v2.
- **Not a consumer product**. The user is always a developer
  integrating via API/SDK.

## Governance

This constitution supersedes all other practices, conventions, and
ad-hoc decisions for the Fio project. Compliance is mandatory.

### Amendment Procedure

1. Propose the change with rationale in a pull request modifying
   this file.
2. The change MUST include a Sync Impact Report (HTML comment at
   top of file) listing affected templates and artifacts.
3. All dependent templates (plan, spec, tasks, checklist) MUST be
   reviewed for consistency before merging.
4. Version MUST be incremented according to semantic versioning:
   - **MAJOR**: Principle removal or backward-incompatible
     redefinition.
   - **MINOR**: New principle or materially expanded guidance.
   - **PATCH**: Clarifications, wording, or non-semantic refinements.

### Compliance Review

- Every PR MUST be checked against the constitution principles.
- Constitution violations MUST be resolved before merge — no
  exceptions for "we'll fix it later".
- The state machine principle (III) and money safety principle (IV)
  are NON-NEGOTIABLE and cannot be waived under any circumstance.

### Founder as First User

The founder dogfoods Fio. Any friction experienced during
integration MUST be treated as a P1 bug in developer experience.

**Version**: 1.1.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-04
