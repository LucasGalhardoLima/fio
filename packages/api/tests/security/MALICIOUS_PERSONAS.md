# Malicious Persona Test Suite

## Purpose

Define adversarial test coverage to protect reliability and trust from day one. Each persona represents a distinct attack vector that must be systematically tested and defended against.

## Personas

### 1. Credential Thief (API Key Compromise)

**Motivation**: Steal or abuse compromised API keys to access accounts they shouldn't.

**Attack Vectors**:
- Bruteforce API key prefixes
- Use expired API keys
- Use revoked API keys
- Attempt to access other accounts' resources
- Session hijacking via stolen session tokens

**Defense Controls**:
- Argon2 key hashing (no plaintext storage)
- Key prefix lookups with full hash verification
- Revocation checks on every request
- Expiration validation
- Multi-tenant isolation at database level

**Test Coverage**:
- ✅ `auth-isolation.test.ts` - Cross-account isolation
- ✅ `auth-isolation.test.ts` - Revoked/expired key rejection
- 🆕 Bruteforce/timing attack resistance

---

### 2. Replay Attacker (Webhook & Request Replay)

**Motivation**: Capture and replay legitimate requests to trigger duplicate actions (double charges, duplicate subscriptions, etc.).

**Attack Vectors**:
- Replay webhook events with valid signatures
- Replay API requests to create duplicate resources
- Reuse old idempotency keys after expiration
- Timestamp manipulation in webhooks

**Defense Controls**:
- Webhook timestamp validation (5-minute window)
- Idempotency keys (24-hour TTL)
- Event ID deduplication in webhook processing
- Timing-safe signature comparison

**Test Coverage**:
- ✅ `integration/jobs/idempotency-cleanup.test.ts` - Idempotency cleanup
- 🆕 Webhook replay with expired timestamps
- 🆕 Idempotency key reuse after TTL
- 🆕 Duplicate event ID handling

---

### 3. Webhook Forger (Signature Bypass)

**Motivation**: Forge webhook events to trigger unauthorized state changes without going through the actual payment flow.

**Attack Vectors**:
- Send webhooks without signatures
- Send webhooks with invalid signatures
- Modify webhook payload and reuse signature
- Timing attacks on signature verification
- Signature algorithm confusion (e.g., using MD5 instead of SHA256)

**Defense Controls**:
- HMAC-SHA256 signature verification
- Timing-safe comparison (timingSafeEqual)
- Strict signature format validation
- Timestamp-bound signatures

**Test Coverage**:
- 🆕 Missing signature rejection
- 🆕 Invalid signature rejection
- 🆕 Payload tampering detection
- 🆕 Signature format validation
- 🆕 Timing attack resistance

---

### 4. Abuse Actor (Resource Exhaustion)

**Motivation**: Exhaust system resources via excessive requests, large payloads, or automated attacks.

**Attack Vectors**:
- Rate limit bypass attempts
- Distributed requests from multiple IPs
- Large request bodies
- Recursive/circular subscription creation
- Mass customer/charge creation
- Webhook endpoint spamming

**Defense Controls**:
- Rate limiting (100 req/min per account)
- Request body size limits
- Webhook retry backoff
- Database query timeouts
- Connection pool limits

**Test Coverage**:
- 🆕 Rate limit enforcement
- 🆕 Rate limit headers validation
- 🆕 Distributed abuse detection (multiple IPs)
- 🆕 Large payload rejection
- 🆕 Webhook retry backoff validation

---

### 5. Internal Misuse (Privilege Escalation)

**Motivation**: Abuse legitimate access to gain unauthorized privileges or access restricted resources.

**Attack Vectors**:
- Test mode keys accessing live data
- Live mode keys accessing test data
- Account A viewing account B resources via ID guessing
- Modification of immutable fields (e.g., charge amounts after creation)
- SQL injection via filter parameters
- Path traversal in resource IDs

**Defense Controls**:
- Environment isolation (test vs live)
- Resource ownership validation on every query
- Input validation with Zod schemas
- Parameterized queries (Kysely)
- Immutable field protection

**Test Coverage**:
- ✅ `auth-isolation.test.ts` - Cross-account isolation
- 🆕 Test/live environment isolation
- 🆕 ID guessing/enumeration prevention
- 🆕 Immutable field protection
- 🆕 SQL injection resistance

---

## CI Gate Criteria

### Pass Thresholds

All security tests must pass with the following criteria:

| Category | Threshold | Enforcement |
|----------|-----------|-------------|
| **Security test coverage** | 100% of defined persona tests pass | ❌ Block merge |
| **Auth bypass attempts** | 0 successful bypasses | ❌ Block merge |
| **Rate limit violations** | 0 unthrottled requests | ❌ Block merge |
| **Webhook signature forgery** | 0 accepted forged events | ❌ Block merge |
| **Cross-account access** | 0 successful leaks | ❌ Block merge |
| **Replay attacks** | 0 duplicate actions | ❌ Block merge |

### Baseline Test Requirements

Minimum tests required before production:

- [ ] 5 personas with at least 3 attack vectors each = **15 baseline tests**
- [ ] Webhook signature validation (5 attack vectors)
- [ ] Replay protection (4 attack vectors)
- [ ] Idempotency enforcement (3 attack vectors)
- [ ] Rate limit enforcement (3 attack vectors)
- [ ] Multi-tenant isolation (5 attack vectors)

**Total baseline: 35 security tests**

---

## Test Naming Convention

```typescript
describe('Persona: [Name] — [Attack Category]', () => {
  it('blocks [specific attack vector]', async () => {
    // Attack simulation
    // Defense verification
  })
})
```

Example:
```typescript
describe('Persona: Webhook Forger — Signature Bypass', () => {
  it('blocks webhooks with missing signatures', async () => {
    // ...
  })
})
```

---

## Maintenance

- **Review frequency**: Every sprint
- **Update triggers**: New attack discovered, new endpoint added, compliance requirement
- **Ownership**: Security team + Engineering team
- **Audit trail**: All security test changes require PR review + security team approval

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- Webhook security: [Stripe](https://stripe.com/docs/webhooks/best-practices), [GitHub](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
