# Research: Subscription Billing MVP

## Decision Log

### D1: API Framework — Fastify

**Decision**: Use Fastify (v5) over Hono.

**Rationale**:
- Scoped plugin system (`fastify.register()`) enables isolated middleware
  chains per route group — critical for a multi-tenant billing API where
  public webhook endpoints, authenticated API routes, and dashboard
  routes need different auth/rate-limit compositions.
- Production-grade middleware ecosystem: `@fastify/rate-limit` (Redis-
  backed), `@fastify/auth`, `@fastify/cors`, `@fastify/swagger`.
- Better Node.js 20 performance (~85K req/s vs ~65K for Hono on Node).
- `@fastify/type-provider-zod` provides end-to-end Zod type inference.
- `fastify.inject()` for testing without HTTP server — pairs with Vitest.

**Alternatives considered**:
- Hono: Better TypeScript ergonomics and best-in-class OpenAPI integration
  via `@hono/zod-openapi`. However, younger ecosystem, less battle-tested
  middleware for Node.js-specific needs (distributed rate limiting,
  idempotency). Hono would be ideal for edge deployments (Cloudflare
  Workers) but Fio runs on Node.js with BullMQ.

### D2: Query Builder — Kysely

**Decision**: Use Kysely over Drizzle ORM.

**Rationale**:
- Absolute SQL predictability: every method maps 1:1 to a SQL clause.
  In a billing system, you must audit exactly what SQL runs during state
  machine transitions and money operations.
- Superior transaction API: the `trx` object is type-identical to `db`,
  making it trivial to compose atomic billing operations (charge +
  invoice + subscription transition) across service boundaries.
- Conservative, stable API: fewer breaking changes over time, which
  matters for a billing system that accrues years of migration history.

**Alternatives considered**:
- Drizzle: Better JSONB first-class support (`jsonb<T>()`) and built-in
  migration diffing via `drizzle-kit`. However, the higher-level
  `db.query` API can obscure final SQL, and the faster release cadence
  has introduced breaking changes. For billing, Kysely's stability and
  SQL transparency are more valuable.

**Migration approach**: Write explicit TypeScript migration files using
Kysely's schema builder. More verbose than auto-diffs but forces
deliberate review of every schema change — the correct posture for a
billing database.

### D3: Dashboard Framework — Next.js (App Router)

**Decision**: Use Next.js with App Router.

**Rationale**:
- Ecosystem alignment: SDK is TypeScript, dashboard and SDK can share
  types from a shared package in the monorepo.
- SSR for auth pages (login, magic link callback) and SEO-irrelevant
  dashboard pages can use client-side rendering.
- Largest React ecosystem for component libraries (shadcn/ui).

**Alternatives considered**:
- Vite + React: Lighter, no SSR overhead. But the dashboard needs
  server-side auth session handling, and Next.js API routes can proxy
  to the billing API for the dashboard without CORS complexity.

### D4: Documentation — Fumadocs

**Decision**: Use Fumadocs over Mintlify.

**Rationale**:
- Free and self-hosted (Next.js-based) — fits the indie dev budget.
  Mintlify costs $150+/mo.
- Full control over deployment and customization.
- Supports MDX, OpenAPI integration, and search.

**Alternatives considered**:
- Mintlify: Better out-of-the-box design and API playground. But the
  cost is prohibitive for MVP. Can migrate to Mintlify later if revenue
  justifies it.

### D5: Infrastructure — Railway

**Decision**: Use Railway for MVP deployment.

**Rationale**:
- Managed PostgreSQL and Redis in one platform.
- Simple deploy from GitHub with zero config.
- Reasonable pricing for MVP scale.
- Easy to add workers (BullMQ) as separate services.

**Alternatives considered**:
- Fly.io: Better global edge distribution. But Fio serves Brazilian
  developers — single-region (São Paulo) is sufficient for MVP.
  Railway is simpler for a solo developer.

### D6: Sandbox Isolation — API Key Prefix Routing

**Decision**: Same database, data isolated by `environment` column
derived from API key prefix (`fio_test_` vs `fio_live_`).

**Rationale**:
- Simplest isolation model for MVP: every query includes an
  `environment` filter via middleware, injected automatically from
  the API key.
- No separate databases or schemas to manage.
- Key entities (accounts, customers, charges, subscriptions) all have
  an `environment` column (`test` | `live`).
- API key prefix determines environment at auth middleware level.

**Alternatives considered**:
- Separate PostgreSQL schemas: stronger isolation but doubles migration
  complexity and requires schema-aware connection pooling.
- Separate databases: strongest isolation but operational overhead is
  too high for a solo developer.

### D7: Efí Pay Integration Patterns

**Decision**: Implement `PaymentProvider` interface wrapping Efí Pay
API with mTLS + OAuth2 authentication.

**Key integration findings**:

**Authentication**: Efí requires mTLS (client certificate) + OAuth2
`client_credentials` grant. Every request needs both the TLS certificate
and a Bearer token. Tokens expire in 3600s — cache them.

**PIX Cobrança flow**:
1. `PUT /v2/cob/{txid}` — create charge (you generate txid)
2. `GET /v2/loc/{id}/qrcode` — get QR code image + copia-e-cola string
3. Webhook fires on payment with `pix[]` array (always iterate)

**PIX Automático (consent flow)**:
1. `POST /v2/gn/automatico/consentimento` — initiate consent
2. Customer redirected to bank for authorization
3. Bank redirects back with consent status
4. `POST /v2/gn/automatico/cobranca` — schedule automatic charges
5. 48h advance notice required before first charge after consent

**Refunds**: `PUT /v2/pix/{endToEndId}/devolucao/{id}` — partial/full.
Requires `endToEndId` from payment webhook — MUST be stored.

**Sandbox**: Separate base URL (`pix-h.api.efipay.com.br`) + separate
certificate. Simulate payment via `PUT /v2/gn/sandbox/{txid}`.

**Critical gotchas**:
- mTLS is mandatory even with valid Bearer token
- Webhook payload `pix[]` is an array — always iterate
- `endToEndId` must be stored from webhook for refunds
- Pix Automático: max 3 retries in 7 days (BC regulation)
- Pix Automático: not all banks support it (~60-70% coverage)
- Token caching required (rate-limited if fetched per request)
- Amounts are strings with 2 decimal places in Efí API (convert
  to/from centavos integers at the provider boundary)

### D8: Monorepo Structure — pnpm Workspaces

**Decision**: pnpm workspace monorepo with 4 packages.

**Rationale**:
- Shared TypeScript types between API, SDK, and dashboard.
- Single `tsconfig` base with per-package overrides.
- SDK needs API types at build time for full type coverage.
- Independent deployment: each package builds and deploys separately.

**Structure**: `packages/api`, `packages/dashboard`, `packages/sdk`,
`packages/shared` (internal types, Zod schemas, constants).
