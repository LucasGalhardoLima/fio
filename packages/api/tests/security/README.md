# Security Test Suite

Adversarial test coverage to protect reliability and trust from day one.

## Quick Start

```bash
# Run all security tests
pnpm test:security

# Run in watch mode during development
pnpm test:security:watch

# Run specific persona tests
pnpm vitest run packages/api/tests/security/webhook-forger.test.ts
pnpm vitest run packages/api/tests/security/replay-attacker.test.ts
pnpm vitest run packages/api/tests/security/abuse-actor.test.ts
pnpm vitest run packages/api/tests/security/privilege-escalation.test.ts
```

## Test Coverage

### Implemented Personas

| Persona | Test File | Attack Vectors | Status |
|---------|-----------|----------------|--------|
| **Webhook Forger** | `webhook-forger.test.ts` | 18 tests | ✅ Complete |
| **Replay Attacker** | `replay-attacker.test.ts` | 8 tests | ✅ Complete |
| **Abuse Actor** | `abuse-actor.test.ts` | 12 tests | ✅ Complete |
| **Credential Thief & Internal Misuse** | `privilege-escalation.test.ts` | 12 tests | ✅ Complete |

**Total: 50 security tests** (exceeds 35 baseline requirement)

### Coverage by Attack Category

#### 1. Webhook Signature Attacks
- ✅ Missing signature rejection
- ✅ Malformed signature format
- ✅ Invalid timestamp format
- ✅ Incorrect signature detection
- ✅ Wrong secret detection
- ✅ Payload tampering detection
- ✅ Expired timestamp (replay attack)
- ✅ Future timestamp (clock skew attack)
- ✅ Timing-safe comparison verification
- ✅ Algorithm confusion (MD5, SHA1 rejection)
- ✅ Tolerance window enforcement

#### 2. Replay Protection
- ✅ Duplicate request blocking with idempotency keys
- ✅ Idempotency key expiration (24h TTL)
- ✅ Cross-account idempotency isolation
- ✅ Method-specific idempotency (POST/PUT only)
- ✅ Status code preservation on replay
- ✅ Authentication requirement for idempotency
- ✅ Concurrent request deduplication

#### 3. Rate Limiting & Resource Exhaustion
- ✅ Rate limit enforcement (100 req/min)
- ✅ Rate limit headers (X-RateLimit-*)
- ✅ Retry-After header on limit
- ✅ Cross-account rate limit isolation
- ✅ IP-based rate limiting for unauthed requests
- ✅ Large payload rejection
- ✅ Mass resource creation prevention
- ✅ Webhook endpoint creation limits
- ✅ Pagination limit enforcement
- ✅ Invalid cursor rejection

#### 4. Authentication & Authorization
- ✅ Missing/invalid auth header rejection
- ✅ Non-existent API key rejection
- ✅ Revoked API key rejection
- ✅ Expired API key rejection
- ✅ Cross-account resource isolation
- ✅ Environment isolation (test vs live)
- ✅ ID guessing/enumeration prevention
- ✅ Information leak prevention (consistent 404s)

#### 5. Privilege Escalation Prevention
- ✅ Immutable field protection (charge amounts)
- ✅ Immutable field protection (customer_id on subscriptions)
- ✅ SQL injection prevention (email field)
- ✅ SQL injection prevention (filter parameters)
- ✅ Parameterized query enforcement

## CI Gate Requirements

All security tests must pass before merge. CI enforces:

| Threshold | Requirement | Status |
|-----------|-------------|--------|
| **Test count** | Minimum 35 tests | ✅ 50/35 |
| **Auth bypass** | 0 successful bypasses | ✅ Enforced |
| **Rate limit** | 0 unthrottled requests | ✅ Enforced |
| **Webhook forgery** | 0 accepted forged events | ✅ Enforced |
| **Cross-account** | 0 successful leaks | ✅ Enforced |
| **Replay attacks** | 0 duplicate actions | ✅ Enforced |

See [MALICIOUS_PERSONAS.md](./MALICIOUS_PERSONAS.md) for detailed persona specifications.

## Adding New Tests

When adding new endpoints or security controls:

1. **Identify attack vectors** - What could go wrong?
2. **Choose persona** - Which adversary would exploit this?
3. **Write tests** - Follow naming convention:
   ```typescript
   describe('Persona: [Name] — [Category]', () => {
     it('blocks [specific attack]', async () => {
       // Attack simulation
       // Defense verification
     })
   })
   ```
4. **Update docs** - Add to MALICIOUS_PERSONAS.md and this README

## Maintenance

- **Review frequency**: Every sprint
- **Update triggers**: 
  - New endpoint added
  - New security control implemented
  - Attack discovered in the wild
  - Compliance requirement change
- **Ownership**: Security team + Engineering team
- **Approval**: All security test changes require PR review + security team approval

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [MALICIOUS_PERSONAS.md](./MALICIOUS_PERSONAS.md) - Detailed persona specifications
- [Stripe Webhook Security](https://stripe.com/docs/webhooks/best-practices)
- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

## Local Development

Run security tests during development to catch issues early:

```bash
# Watch mode for active development
pnpm test:security:watch

# Full test suite (slower, includes integration tests)
pnpm test

# Run with coverage
pnpm vitest run packages/api/tests/security --coverage
```

## Debugging Failed Tests

If a security test fails:

1. **Don't bypass it** - Security tests exist to prevent real attacks
2. **Understand the threat** - Read the persona spec to understand what's being protected
3. **Fix the vulnerability** - Update the code to properly defend against the attack
4. **Verify the fix** - Ensure the test passes and similar attacks are also blocked
5. **Document it** - Update docs if the fix changes behavior

## Production Monitoring

Security tests verify defenses at build time. In production, monitor:

- Failed auth attempts (potential credential theft)
- Rate limit hits (potential abuse)
- Webhook verification failures (potential forgery)
- Unusual access patterns (potential enumeration)

Configure alerts for anomalies in your monitoring system (Datadog, Sentry, etc.).
