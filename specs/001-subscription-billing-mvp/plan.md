# Implementation Plan: Subscription Billing MVP for PIX

**Branch**: `001-subscription-billing-mvp` | **Date**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-subscription-billing-mvp/spec.md`

## Summary

Build Fio v1.0 — a developer-first subscription billing API for PIX.
The system provides a REST API (Fastify) for managing customers, plans,
subscriptions, and charges, with an event-sourced billing engine,
subscription state machine, dunning, Pix Automático support, webhooks,
a dashboard (Next.js), and a TypeScript SDK (`@fio-pay/sdk`). All PSP
communication is abstracted behind a `PaymentProvider` interface (Efí
Pay implementation). Deployed on Railway with PostgreSQL + Redis.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`) / Node.js 20+
**Primary Dependencies**: Fastify 5, Kysely, BullMQ, Zod, Next.js 15
**Storage**: PostgreSQL 16 (via Kysely, JSONB for flexible fields),
Redis 7 (BullMQ queues)
**Testing**: Vitest, real PostgreSQL with test transactions
**Target Platform**: Linux server (Railway, São Paulo region)
**Project Type**: Web service (REST API) + Web app (dashboard) + Library (SDK)
**Performance Goals**: <200ms p95 API latency, 100 req/s sustained
**Constraints**: BRL centavos (integer) for all money, mTLS for Efí Pay,
Pix Automático BC regulations (max 3 retries/7 days)
**Scale/Scope**: 50 developers, 2000 subscriptions, R$500K/month GMV
target (first 6 months)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | PSP Abstraction | PASS | `PaymentProvider` interface in `src/providers/`. Efí Pay implementation separate from business logic. Mock provider for tests. |
| II | Event-Sourced Billing | PASS | Append-only `events` table. Every state change emits event via `EventEmitter` service → BullMQ webhook job. |
| III | State Machine (NON-NEG) | PASS | `SubscriptionStateMachine` class in `src/domain/`. 5 states, validated transitions, event+webhook on each. Tests for every transition (happy + invalid). |
| IV | Money Safety (NON-NEG) | PASS | All amounts as `integer` (centavos) in DB, API, and webhooks. Conversion at Efí provider boundary only (Efí uses decimal strings). Zod schemas enforce `z.number().int()`. |
| V | Async Jobs | PASS | BullMQ queues: `billing-cycle`, `dunning`, `webhook-delivery`, `pix-automatico-consent`. No synchronous side effects in API handlers. |
| VI | DX is the Product | PASS | SDK with full types, quickstart <5 min, actionable errors with format hints, sandbox with payment simulation + accelerated dunning. |
| VII | API Contract | PASS | RESTful JSON, `/v1` prefix, cursor pagination, structured errors, Bearer auth, `Idempotency-Key` header, rate limiting headers. |
| VIII | Security by Default | PASS | API keys hashed (argon2), HMAC-SHA256 webhooks, PII masking in logs, PSP credentials encrypted, sandbox/production isolated by API key prefix. |
| IX | Test-First | PASS | Vitest, real PostgreSQL, state machine transition tests, dunning integration tests, webhook delivery tests. Target 90%+ billing coverage. |
| X | Strict TS, No Magic | PASS | TypeScript strict, Kysely (not ORM), Zod validation, functions over classes (except state machine), 300-line file limit. |

**Gate result: ALL PASS. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/001-subscription-billing-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-v1.md
│   └── webhook-events.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── api/                          # Core billing API (Fastify)
│   ├── src/
│   │   ├── app.ts                # Fastify app setup, plugin registration
│   │   ├── server.ts             # Server entry point
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── customers.ts
│   │   │   │   ├── plans.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   ├── charges.ts
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── webhook-endpoints.ts
│   │   │   │   ├── webhook-deliveries.ts
│   │   │   │   ├── metrics.ts
│   │   │   │   └── test.ts       # Sandbox simulation endpoints
│   │   │   └── webhooks/
│   │   │       └── efi-callback.ts  # Efí Pay webhook receiver
│   │   ├── domain/
│   │   │   ├── subscription-state-machine.ts
│   │   │   ├── charge-state-machine.ts
│   │   │   └── invoice-state-machine.ts
│   │   ├── services/
│   │   │   ├── customer-service.ts
│   │   │   ├── plan-service.ts
│   │   │   ├── subscription-service.ts
│   │   │   ├── charge-service.ts
│   │   │   ├── invoice-service.ts
│   │   │   ├── event-service.ts
│   │   │   ├── webhook-service.ts
│   │   │   └── metrics-service.ts
│   │   ├── providers/
│   │   │   ├── payment-provider.ts    # Interface definition
│   │   │   ├── efi-provider.ts        # Efí Pay implementation
│   │   │   └── mock-provider.ts       # Test/sandbox provider
│   │   ├── jobs/
│   │   │   ├── queue-setup.ts
│   │   │   ├── billing-cycle.ts
│   │   │   ├── dunning-retry.ts
│   │   │   ├── webhook-delivery.ts
│   │   │   ├── pix-automatico-consent.ts
│   │   │   ├── charge-expiration.ts
│   │   │   ├── idempotency-cleanup.ts
│   │   │   └── api-key-revocation.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts               # API key authentication
│   │   │   ├── rate-limit.ts
│   │   │   ├── idempotency.ts
│   │   │   └── error-handler.ts
│   │   ├── db/
│   │   │   ├── connection.ts         # Kysely setup
│   │   │   ├── types.ts             # Generated DB types
│   │   │   ├── migrations/
│   │   │   │   └── 001-initial-schema.ts
│   │   │   └── queries/
│   │   │       ├── customers.ts
│   │   │       ├── plans.ts
│   │   │       ├── subscriptions.ts
│   │   │       ├── charges.ts
│   │   │       ├── invoices.ts
│   │   │       ├── events.ts
│   │   │       ├── webhook-endpoints.ts
│   │   │       └── webhook-deliveries.ts
│   │   └── lib/
│   │       ├── errors.ts            # Structured error types
│   │       ├── cpf-cnpj.ts          # Validation helpers
│   │       ├── money.ts             # Centavos conversion
│   │       ├── api-keys.ts          # Generation, hashing, prefix
│   │       ├── hmac.ts              # Webhook signature
│   │       ├── pagination.ts        # Cursor-based pagination
│   │       └── pii-mask.ts          # Log masking
│   └── tests/
│       ├── unit/
│       │   ├── domain/
│       │   │   ├── subscription-state-machine.test.ts
│       │   │   ├── charge-state-machine.test.ts
│       │   │   └── invoice-state-machine.test.ts
│       │   └── lib/
│       │       ├── cpf-cnpj.test.ts
│       │       └── money.test.ts
│       ├── integration/
│       │   ├── routes/
│       │   │   ├── customers.test.ts
│       │   │   ├── charges.test.ts
│       │   │   └── subscriptions.test.ts
│       │   ├── services/
│       │   │   └── dunning.test.ts
│       │   └── jobs/
│       │       └── webhook-delivery.test.ts
│       └── helpers/
│           ├── setup.ts             # Test DB, fixtures
│           └── mock-provider.ts
│
├── dashboard/                    # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── overview/
│   │   │   │   ├── customers/
│   │   │   │   ├── subscriptions/
│   │   │   │   ├── charges/
│   │   │   │   ├── webhooks/
│   │   │   │   └── settings/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   └── lib/
│   └── tests/
│
├── sdk/                          # @fio-pay/sdk (npm)
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── resources/
│   │   │   ├── customers.ts
│   │   │   ├── plans.ts
│   │   │   ├── subscriptions.ts
│   │   │   ├── charges.ts
│   │   │   ├── invoices.ts
│   │   │   └── webhook-endpoints.ts
│   │   ├── webhooks.ts           # Signature verification
│   │   ├── errors.ts             # Typed error classes
│   │   └── types.ts              # All entity types
│   └── tests/
│
├── docs/                         # Fumadocs documentation site
│   ├── content/
│   │   ├── quickstart.mdx
│   │   ├── guides/
│   │   ├── api/
│   │   └── webhooks.mdx
│   └── public/
│
└── shared/                       # Internal shared package
    └── src/
        ├── schemas/              # Zod schemas (used by API + SDK)
        ├── types/                # Shared TypeScript types
        └── constants.ts          # Event types, status enums
```

**Structure Decision**: pnpm workspace monorepo with 5 packages. The
`shared` package holds Zod schemas and TypeScript types used by both
the API and SDK, ensuring type consistency. The `docs` package is a
Fumadocs site for developer documentation. Each package builds and
deploys independently. The MCP server is a separate repository (MIT
licensed) and is not part of this monorepo.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
