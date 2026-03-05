# Analysis Remediation Design

**Date**: 2026-03-04
**Source**: `/speckit.analyze` report — 15 findings (3 LOW, 8 MEDIUM, 4 HIGH)
**Files affected**: tasks.md, plan.md, constitution.md, spec.md, data-model.md, contracts/api-v1.md, quickstart.md

## Decision: MCP Server Location

Separate repository (not monorepo). Aligns with MIT licensing separation from proprietary core API.

## LOW Fixes

### D1 — FR-014/FR-049 duplication (spec.md)

Add cross-reference note to FR-014 pointing to FR-049. Both requirements stay — FR-014 is subscription-specific, FR-049 is the general rule.

### F4 — `pix_qr_code_url` naming (data-model.md, api-v1.md, quickstart.md)

Rename `pix_qr_code_url` → `pix_qr_code_image` across all three files. The field returns base64 data, not a hosted URL.

### U8 — 300-line file limit (tasks.md)

Add T110 in Phase 12: ESLint/CI rule enforcing max 300 lines per file.

## MEDIUM Fixes

### F2 — T022/T065 overlap (tasks.md)

Scope T022 to event persistence only. T065 adds webhook dispatching to event service.

### U4 — `packages/docs/` missing (plan.md, tasks.md)

Add `packages/docs/` to plan project structure. Update T001 to include it in pnpm-workspace.yaml.

### F3 — Constitution "or" language (constitution.md)

Resolve: Hono → Fastify, Mintlify → Fumadocs, Railway or Fly.io → Railway, Next.js (or Vite + React) → Next.js 15. Version bump 1.0.0 → 1.1.0.

### U5 — Magic link deferred (spec.md, tasks.md)

Defer magic link to post-MVP. Update assumption in spec.md. Remove from T073.

### U6 — Idempotency key cleanup (tasks.md)

Add T111: BullMQ job to delete expired idempotency keys.

### U7 — API key auto-revocation (tasks.md)

Add T112: Scheduled job to revoke expired API keys after 24h grace.

### C1 — Load test (tasks.md)

Add T113: Load test with autocannon — 100 req/s, <200ms p95.

### C2 — Doc examples in CI (tasks.md)

Add T114: CI job running quickstart code against sandbox.

## HIGH Fixes

### U1 — Charge + invoice state machines (tasks.md)

- T115 [US1]: Create charge state machine (6 states, validated transitions, events)
- T116 [US2]: Create invoice state machine (5 states, validated transitions, events)
- T117 [P] [US1]: Unit tests for charge state machine
- T118 [P] [US2]: Unit tests for invoice state machine

### U2 — Charge expiration job (tasks.md)

- T119 [US1]: BullMQ repeatable job (every 5 min), expire pending charges past expires_at
- Update T023 to include charge-expiration queue

### F1 — MCP as separate repo (plan.md, tasks.md)

- Update plan.md to reaffirm separate repo
- Update T100-T102 paths to standalone repo structure
- Replace T103 with a note that API event service already accepts metadata.agent_id

### U3 — SDK test resource (tasks.md)

- T120 [US7]: SDK test resource — simulatePayment(), advanceTime() for sandbox endpoints

## New Tasks Summary

T110-T120 (11 new tasks). Total: 109 → 120 tasks.
