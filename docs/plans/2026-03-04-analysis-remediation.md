# Analysis Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 15 findings from the `/speckit.analyze` report across 7 spec/design files.

**Architecture:** Direct edits to existing spec artifacts. No code changes — all edits are to markdown specification files. New tasks appended as T110-T120 to preserve existing task ID stability.

**Tech Stack:** Markdown files only. Edit tool for surgical changes.

---

### Task 1: D1 — Add cross-reference to FR-014 (spec.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/spec.md:392-393`

**Step 1: Edit FR-014 to reference FR-049**

Replace:
```
- **FR-014**: Every state transition MUST produce an immutable event
  and trigger a webhook delivery.
```
With:
```
- **FR-014**: Every state transition MUST produce an immutable event
  and trigger a webhook delivery (see FR-049 for general immutability rule).
```

**Step 2: Verify**

Read spec.md lines 392-394 and confirm the cross-reference is present.

**Step 3: Commit**

```bash
git add specs/001-subscription-billing-mvp/spec.md
git commit -m "docs: add cross-reference FR-014→FR-049 to reduce duplication (D1)"
```

---

### Task 2: F4 — Rename pix_qr_code_url → pix_qr_code_image (3 files)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/data-model.md:171`
- Modify: `specs/001-subscription-billing-mvp/contracts/api-v1.md` (3 occurrences)
- Modify: `specs/001-subscription-billing-mvp/quickstart.md:42`

**Step 1: Edit data-model.md**

Replace:
```
| pix_qr_code_url | text | | Base64 PNG or hosted URL |
```
With:
```
| pix_qr_code_image | text | | Base64 PNG data URI |
```

**Step 2: Edit api-v1.md**

Replace all occurrences of `pix_qr_code_url` with `pix_qr_code_image` (use replace_all). There are 2 occurrences: one in the charge response schema and one in the charge fields list.

**Step 3: Edit quickstart.md**

Replace:
```
console.log(charge.pix_qr_code_url) // Imagem QR code (base64)
```
With:
```
console.log(charge.pix_qr_code_image) // Imagem QR code (base64 data URI)
```

**Step 4: Verify**

Grep all 3 files for `pix_qr_code_url` — should return 0 results. Grep for `pix_qr_code_image` — should return 3+ results.

**Step 5: Commit**

```bash
git add specs/001-subscription-billing-mvp/data-model.md specs/001-subscription-billing-mvp/contracts/api-v1.md specs/001-subscription-billing-mvp/quickstart.md
git commit -m "docs: rename pix_qr_code_url to pix_qr_code_image for accuracy (F4)"
```

---

### Task 3: U8 — Add 300-line enforcement task (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md:286`

**Step 1: Add T110 after T109 in Phase 12**

Insert after the line `- [ ] T109 Run quickstart.md validation end-to-end...`:
```
- [ ] T110 [P] Add ESLint rule or CI check enforcing max 300 lines per file per constitution principle X in `eslint.config.mjs`
```

**Step 2: Verify**

Read tasks.md and confirm T110 appears in Phase 12 after T109.

---

### Task 4: F2 — Scope T022 to event persistence only (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md:61`

**Step 1: Update T022 description**

Replace:
```
- [ ] T022 Create event service in `packages/api/src/services/event-service.ts` — insert event into append-only events table with entity snapshot, emit webhook delivery jobs for matching endpoints
```
With:
```
- [ ] T022 Create event service in `packages/api/src/services/event-service.ts` — insert event into append-only events table with entity snapshot, return created event (webhook dispatching added in T065)
```

**Step 2: Verify**

Read tasks.md line 61 and confirm T022 no longer mentions webhook delivery jobs.

---

### Task 5: U4 — Add packages/docs/ to plan project structure (plan.md, tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/plan.md:190-202`
- Modify: `specs/001-subscription-billing-mvp/tasks.md:29`

**Step 1: Add docs package to plan.md project structure**

Replace:
```
└── shared/                       # Internal shared package
    └── src/
        ├── schemas/              # Zod schemas (used by API + SDK)
        ├── types/                # Shared TypeScript types
        └── constants.ts          # Event types, status enums
```

**Structure Decision**: pnpm workspace monorepo with 4 packages. The
```
With:
```
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
```

**Step 2: Update the sentence "4 packages" → "5 packages"**

Replace:
```
`shared` package holds Zod schemas and TypeScript types used by both
the API and SDK, ensuring type consistency. Each package builds and
```
With:
```
`shared` package holds Zod schemas and TypeScript types used by both
the API and SDK, ensuring type consistency. The `docs` package is a
Fumadocs site for developer documentation. Each package builds and
```

**Step 3: Update T001 in tasks.md**

Replace:
```
- [ ] T001 Initialize pnpm workspace monorepo with `pnpm-workspace.yaml` defining packages/api, packages/dashboard, packages/sdk, packages/shared
```
With:
```
- [ ] T001 Initialize pnpm workspace monorepo with `pnpm-workspace.yaml` defining packages/api, packages/dashboard, packages/sdk, packages/shared, packages/docs
```

**Step 4: Commit**

```bash
git add specs/001-subscription-billing-mvp/plan.md specs/001-subscription-billing-mvp/tasks.md
git commit -m "docs: add packages/docs/ to plan structure and T001 (U4)"
```

---

### Task 6: F3 — Resolve constitution "or" language (constitution.md)

**Files:**
- Modify: `.specify/memory/constitution.md:207-216`

**Step 1: Update Technical Stack section**

Replace:
```
- **API Framework**: Hono (or Fastify)
```
With:
```
- **API Framework**: Fastify 5
```

Replace:
```
- **Infrastructure**: Railway or Fly.io for MVP
```
With:
```
- **Infrastructure**: Railway (São Paulo region)
```

Replace:
```
- **Dashboard**: Next.js (or Vite + React)
```
With:
```
- **Dashboard**: Next.js 15
```

Replace:
```
- **Documentation**: Mintlify or Fumadocs
```
With:
```
- **Documentation**: Fumadocs
```

**Step 2: Update version and date**

Replace:
```
**Version**: 1.0.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-03
```
With:
```
**Version**: 1.1.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-04
```

**Step 3: Update Sync Impact Report comment at top of file**

Replace `Version change: N/A → 1.0.0 (initial adoption)` with `Version change: 1.0.0 → 1.1.0 (resolve tech stack alternatives post-research)`.

**Step 4: Also update principle X** which references "Kysely or Drizzle"

Replace:
```
- No ORMs — use raw SQL with a thin query builder (Kysely or
  Drizzle). Billing logic needs predictable queries, not magic.
```
With:
```
- No ORMs — use raw SQL with a thin query builder (Kysely).
  Billing logic needs predictable queries, not magic.
```

**Step 5: Verify**

Grep constitution.md for " or " — should not appear in tech stack or tooling choices (it's fine in prose like "Adding or swapping").

**Step 6: Commit**

```bash
git add .specify/memory/constitution.md
git commit -m "docs: resolve tech stack alternatives in constitution v1.1.0 (F3)"
```

---

### Task 7: U5 — Defer magic link to post-MVP (spec.md, tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/spec.md:567-568`
- Modify: `specs/001-subscription-billing-mvp/tasks.md:202-203`

**Step 1: Update spec.md assumption**

Replace:
```
- Dashboard authentication uses email + password with magic link as an
  alternative login method.
```
With:
```
- Dashboard authentication uses email + password. Magic link login is
  deferred to post-MVP.
```

**Step 2: Update T073 in tasks.md**

Replace:
```
- [ ] T073 [US6] Implement dashboard auth pages in `packages/dashboard/src/app/(auth)/` — register (email + password), login (email + password), magic link flow, session management
```
With:
```
- [ ] T073 [US6] Implement dashboard auth pages in `packages/dashboard/src/app/(auth)/` — register (email + password), login (email + password), session management
```

**Step 3: Update T074 in tasks.md**

Replace:
```
- [ ] T074 [US6] Implement account service in `packages/api/src/services/account-service.ts` — register (hash password with argon2, generate initial test+live API keys), login (verify password, return session token), magic link generation/verification
```
With:
```
- [ ] T074 [US6] Implement account service in `packages/api/src/services/account-service.ts` — register (hash password with argon2, generate initial test+live API keys), login (verify password, return session token)
```

**Step 4: Commit**

```bash
git add specs/001-subscription-billing-mvp/spec.md specs/001-subscription-billing-mvp/tasks.md
git commit -m "docs: defer magic link to post-MVP (U5)"
```

---

### Task 8: U6, U7, C1, C2 — Add 4 new Phase 12 tasks (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md` (after T110 from Task 3)

**Step 1: Add T111-T114 after T110 in Phase 12**

Insert after T110:
```
- [ ] T111 [P] Create idempotency key cleanup job in `packages/api/src/jobs/idempotency-cleanup.ts` — BullMQ repeatable job (hourly), delete rows WHERE expires_at < now()
- [ ] T112 [P] Create API key auto-revocation job in `packages/api/src/jobs/api-key-revocation.ts` — BullMQ repeatable job (hourly), revoke keys WHERE expires_at IS NOT NULL AND expires_at < now() AND revoked_at IS NULL
- [ ] T113 Load test API with `autocannon` in `packages/api/tests/load/` — target 100 req/s sustained, <200ms p95 latency on charge creation and customer listing endpoints
- [ ] T114 Create CI job to validate documentation code examples against sandbox — run quickstart.md and API reference snippets end-to-end in `packages/docs/tests/examples.test.ts`
```

**Step 2: Verify**

Read Phase 12 section and confirm T110-T114 are all present.

---

### Task 9: U1 — Add charge + invoice state machine tasks (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md` (Phase 3 and Phase 4)

**Step 1: Add T115 and T117 to Phase 3 (US1)**

Insert in Phase 3, after T028 (tests section), add:
```
- [ ] T115 [P] [US1] Write unit tests for charge state machine in `packages/api/tests/unit/domain/charge-state-machine.test.ts` — all valid transitions (pending→paid, pending→failed, pending→expired, paid→refunded, paid→partially_refunded), invalid transitions (expired→paid, refunded→pending, etc.), event emission on each transition
```

Insert in Phase 3, after T030 (implementation section), add:
```
- [ ] T116 [US1] Create charge state machine in `packages/api/src/domain/charge-state-machine.ts` — define valid transitions map (6 states), validate transition, emit event on success, return 422 with current state + valid transitions on invalid
```

**Step 2: Add T117 and T118 to Phase 4 (US2)**

Insert in Phase 4, after T041 (tests section), add:
```
- [ ] T117 [P] [US2] Write unit tests for invoice state machine in `packages/api/tests/unit/domain/invoice-state-machine.test.ts` — all valid transitions (draft→open, open→paid, open→failed, open→void), invalid transitions, event emission on each transition
```

Insert in Phase 4, after T042 (implementation section), add:
```
- [ ] T118 [US2] Create invoice state machine in `packages/api/src/domain/invoice-state-machine.ts` — define valid transitions map (5 states: draft, open, paid, failed, void), validate transition, emit event on success, return 422 on invalid
```

**Step 3: Verify**

Read Phase 3 and Phase 4 sections. Confirm T115-T116 in US1, T117-T118 in US2.

---

### Task 10: U2 — Add charge expiration job task (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md:62` (T023)
- Modify: `specs/001-subscription-billing-mvp/tasks.md` (Phase 3 implementation)

**Step 1: Update T023 to include charge-expiration queue**

Replace:
```
- [ ] T023 Create BullMQ queue setup in `packages/api/src/jobs/queue-setup.ts` — define queues (billing-cycle, dunning-retry, webhook-delivery, pix-automatico-consent), Redis connection, shared job options
```
With:
```
- [ ] T023 Create BullMQ queue setup in `packages/api/src/jobs/queue-setup.ts` — define queues (billing-cycle, dunning-retry, webhook-delivery, pix-automatico-consent, charge-expiration), Redis connection, shared job options
```

**Step 2: Add T119 to Phase 3 (US1) implementation section**

Insert after T039:
```
- [ ] T119 [US1] Create charge expiration job in `packages/api/src/jobs/charge-expiration.ts` — BullMQ repeatable job (every 5 min), query charges WHERE expires_at <= now() AND status = 'pending', transition to expired via charge state machine, emit charge.expired events
```

**Step 3: Verify**

Confirm T023 mentions charge-expiration queue and T119 exists in Phase 3.

---

### Task 11: F1 — Update MCP tasks for separate repo (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md:268-271` (T100-T103)

**Step 1: Replace T100-T103**

Replace:
```
- [ ] T100 [US9] Create MCP server package (separate repository or `packages/mcp/`) with TypeScript setup, MIT license
- [ ] T101 [US9] Implement MCP tools in `packages/mcp/src/tools/` — create_charge, create_subscription, list_subscriptions, get_subscription, cancel_subscription — each calling Fio API via SDK
- [ ] T102 [US9] Implement audit logging in `packages/mcp/src/audit.ts` — log each tool invocation with agent_id (from user-agent), timestamp, tool name, input params, output result, stored as event metadata
- [ ] T103 [US9] Update event service to tag agent-initiated actions in `packages/api/src/services/event-service.ts` — accept metadata.agent_id on event creation, display in dashboard event timeline with agent badge
```
With:
```
- [ ] T100 [US9] Create MCP server as separate repository (`fio-mcp-server`) with TypeScript setup, MIT license, @fio-pay/sdk as dependency
- [ ] T101 [US9] Implement MCP tools in `src/tools/` of fio-mcp-server — create_charge, create_subscription, list_subscriptions, get_subscription, cancel_subscription — each calling Fio API via SDK
- [ ] T102 [US9] Implement audit logging in `src/audit.ts` of fio-mcp-server — log each tool invocation with agent_id (from MCP client info), timestamp, tool name, input params, output result; pass agent_id as event metadata via SDK
- [ ] T103 [US9] Ensure event service accepts metadata.agent_id on event creation (already supported by T022 metadata field) — add dashboard display logic to show agent badge on agent-initiated events in `packages/dashboard/src/components/event-timeline.tsx`
```

**Step 2: Verify**

Read T100-T103 and confirm no `packages/mcp/` references remain.

**Step 3: Commit**

```bash
git add specs/001-subscription-billing-mvp/tasks.md
git commit -m "docs: update MCP tasks for separate repo (F1)"
```

---

### Task 12: U3 — Add SDK test resource task (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md` (Phase 9, after T087)

**Step 1: Add T120 after T087 in Phase 9 (US7)**

Insert after the T087 line:
```
- [ ] T120 [US7] Create SDK test resource in `packages/sdk/src/resources/test.ts` — simulatePayment(chargeId) mapping to POST /v1/test/charges/:id/pay, advanceTime(days) mapping to POST /v1/test/time/advance, only available when SDK detects test key prefix
```

**Step 2: Verify**

Read Phase 9 and confirm T120 appears after T087.

---

### Task 13: Update Notes section with new task count (tasks.md)

**Files:**
- Modify: `specs/001-subscription-billing-mvp/tasks.md` (bottom of file)

**Step 1: Update the Parallel Examples section**

Add to the Parallel Examples block:
```
# Phase 3 US1 — new state machine tasks:
T115 (charge SM tests) in parallel with T027 + T028
T116 (charge SM) after T115

# Phase 4 US2 — new state machine tasks:
T117 (invoice SM tests) in parallel with T040 + T041
T118 (invoice SM) after T117
```

**Step 2: Final commit for all tasks.md changes**

```bash
git add specs/001-subscription-billing-mvp/tasks.md specs/001-subscription-billing-mvp/spec.md specs/001-subscription-billing-mvp/plan.md specs/001-subscription-billing-mvp/data-model.md specs/001-subscription-billing-mvp/contracts/api-v1.md specs/001-subscription-billing-mvp/quickstart.md .specify/memory/constitution.md
git commit -m "docs: fix all 15 analysis findings (D1, F1-F4, U1-U8, C1-C2)

- Add charge and invoice state machine tasks (T115-T118)
- Add charge expiration job task (T119)
- Add SDK test resource task (T120)
- Add Phase 12 polish tasks (T110-T114)
- Rename pix_qr_code_url → pix_qr_code_image
- Resolve constitution tech stack alternatives (v1.1.0)
- Update MCP server tasks for separate repo
- Scope T022 event service (webhook dispatch in T065)
- Add packages/docs/ to plan structure
- Defer magic link to post-MVP
- Cross-reference FR-014→FR-049

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
