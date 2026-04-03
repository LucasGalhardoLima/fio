import { describe, it, expect } from 'vitest'
import { validateSubscriptionTransition } from '../../../src/domain/subscription-state-machine.js'
import { SUBSCRIPTION_STATUS } from '@fio-pay/shared'
import type { SubscriptionStatus } from '@fio-pay/shared'

describe('Subscription State Machine', () => {
  describe('valid transitions', () => {
    it('allows trialing -> active (trial expires)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.TRIALING,
          SUBSCRIPTION_STATUS.ACTIVE,
        ),
      ).not.toThrow()
    })

    it('allows trialing -> canceled (developer cancels)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.TRIALING,
          SUBSCRIPTION_STATUS.CANCELED,
        ),
      ).not.toThrow()
    })

    it('allows active -> past_due (charge fails)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.PAST_DUE,
        ),
      ).not.toThrow()
    })

    it('allows active -> canceled (developer cancels)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.CANCELED,
        ),
      ).not.toThrow()
    })

    it('allows active -> paused (developer pauses)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.PAUSED,
        ),
      ).not.toThrow()
    })

    it('allows past_due -> active (retry succeeds)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.PAST_DUE,
          SUBSCRIPTION_STATUS.ACTIVE,
        ),
      ).not.toThrow()
    })

    it('allows past_due -> canceled (dunning exhausted)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.PAST_DUE,
          SUBSCRIPTION_STATUS.CANCELED,
        ),
      ).not.toThrow()
    })

    it('allows paused -> active (developer resumes)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.PAUSED,
          SUBSCRIPTION_STATUS.ACTIVE,
        ),
      ).not.toThrow()
    })

    it('allows paused -> canceled (developer cancels while paused)', () => {
      expect(() =>
        validateSubscriptionTransition(
          SUBSCRIPTION_STATUS.PAUSED,
          SUBSCRIPTION_STATUS.CANCELED,
        ),
      ).not.toThrow()
    })
  })

  describe('invalid transitions', () => {
    const assertInvalidTransition = (
      from: SubscriptionStatus,
      to: SubscriptionStatus,
    ): void => {
      expect(() => validateSubscriptionTransition(from, to)).toThrow()
      try {
        validateSubscriptionTransition(from, to)
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).toContain(from)
        expect(err.message).toContain(to)
      }
    }

    it('rejects canceled -> active', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.CANCELED,
        SUBSCRIPTION_STATUS.ACTIVE,
      )
    })

    it('rejects canceled -> paused', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.CANCELED,
        SUBSCRIPTION_STATUS.PAUSED,
      )
    })

    it('rejects trialing -> paused', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.TRIALING,
        SUBSCRIPTION_STATUS.PAUSED,
      )
    })

    it('rejects trialing -> past_due', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.TRIALING,
        SUBSCRIPTION_STATUS.PAST_DUE,
      )
    })

    it('rejects paused -> past_due', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.PAUSED,
        SUBSCRIPTION_STATUS.PAST_DUE,
      )
    })

    it('rejects canceled -> trialing', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.CANCELED,
        SUBSCRIPTION_STATUS.TRIALING,
      )
    })

    it('rejects canceled -> past_due', () => {
      assertInvalidTransition(
        SUBSCRIPTION_STATUS.CANCELED,
        SUBSCRIPTION_STATUS.PAST_DUE,
      )
    })
  })
})
