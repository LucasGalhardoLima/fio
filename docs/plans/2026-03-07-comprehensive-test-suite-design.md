# Comprehensive Test Suite Design

**Goal:** Achieve full test coverage across money safety, service layer, job queues, auth/isolation, resilience, volume, and route gaps.

## Categories

### 1. Money Safety & Large Amounts (Unit)
- Integer overflow protection at centavos scale (9999999999 centavos = R$99.999.999,99)
- MAX_SAFE_INTEGER boundary
- Refund arithmetic (full, partial, exceeding original)
- MIN_CHARGE_AMOUNT boundary (exactly 100)
- Zero/negative/float rejection
- Decimal string conversion at PSP boundary

### 2. Service Layer (Integration, real Postgres)
- Charge: create, refund (full + partial), expire, PSP callback status update
- Subscription: create with/without trial, cancel (immediate + at_period_end), pause, resume, trial->active, billing period calc
- Invoice: generate from billing cycle, link to charge, paid/failed/void, dunning
- Plan: CRUD with validation

### 3. Job Queues (Integration, real BullMQ)
- Billing cycle: correct invoices for due subs, skip paused/canceled
- Dunning retry: per schedule (1,3,7 days), cancel after exhaustion
- Charge expiration: mark pending as expired after timeout
- Idempotency cleanup: remove keys >24h

### 4. Auth & Multi-Tenant Isolation (Integration)
- Missing/invalid key -> 401
- Cross-account data isolation
- Test vs live key environment separation
- Revoked key rejection
- Rate limiting (429)

### 5. Resilience (Integration)
- PSP timeout -> charge stays pending
- PSP error -> proper propagation, no money lost
- Webhook 5xx -> retry schedule, eventual DLQ
- Concurrent idempotent requests -> single charge
- DB transaction rollback on mid-service error

### 6. Volume & Load (autocannon)
- 1000 subscriptions billing cycle -> all invoices correct
- 100 parallel charges -> all succeed
- All endpoints benchmarked (p95 < 500ms at 100 req/s)
- 10,000 record pagination

### 7. Route Coverage Gaps (Integration)
- Plans CRUD + validation
- Invoices GET/LIST with filters
- Webhook endpoints CRUD
- Metrics with account isolation
- Health/ready endpoints
- Error response format consistency

## Excluded (YAGNI)
- Chaos engineering
- Dashboard E2E
- Pix Automatico (not fully integrated)
- Timezone/DST edge cases
- SDK HTTP retry/timeout
