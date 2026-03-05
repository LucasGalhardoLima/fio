import { describe, it, expect } from 'vitest'
import { validateChargeTransition } from '../../../src/domain/charge-state-machine.js'
import { CHARGE_STATUS } from '@fio-pay/shared'
import type { ChargeStatus } from '@fio-pay/shared'

describe('Charge State Machine', () => {
  describe('valid transitions', () => {
    it('allows pending -> paid', () => {
      expect(() =>
        validateChargeTransition(CHARGE_STATUS.PENDING, CHARGE_STATUS.PAID),
      ).not.toThrow()
    })

    it('allows pending -> failed', () => {
      expect(() =>
        validateChargeTransition(CHARGE_STATUS.PENDING, CHARGE_STATUS.FAILED),
      ).not.toThrow()
    })

    it('allows pending -> expired', () => {
      expect(() =>
        validateChargeTransition(CHARGE_STATUS.PENDING, CHARGE_STATUS.EXPIRED),
      ).not.toThrow()
    })

    it('allows paid -> refunded', () => {
      expect(() =>
        validateChargeTransition(CHARGE_STATUS.PAID, CHARGE_STATUS.REFUNDED),
      ).not.toThrow()
    })

    it('allows paid -> partially_refunded', () => {
      expect(() =>
        validateChargeTransition(
          CHARGE_STATUS.PAID,
          CHARGE_STATUS.PARTIALLY_REFUNDED,
        ),
      ).not.toThrow()
    })

    it('allows partially_refunded -> refunded', () => {
      expect(() =>
        validateChargeTransition(
          CHARGE_STATUS.PARTIALLY_REFUNDED,
          CHARGE_STATUS.REFUNDED,
        ),
      ).not.toThrow()
    })

    it('allows partially_refunded -> partially_refunded', () => {
      expect(() =>
        validateChargeTransition(
          CHARGE_STATUS.PARTIALLY_REFUNDED,
          CHARGE_STATUS.PARTIALLY_REFUNDED,
        ),
      ).not.toThrow()
    })
  })

  describe('invalid transitions', () => {
    const assertInvalidTransition = (from: ChargeStatus, to: ChargeStatus): void => {
      expect(() => validateChargeTransition(from, to)).toThrow()
      try {
        validateChargeTransition(from, to)
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).toContain(from)
        expect(err.message).toContain(to)
      }
    }

    it('rejects expired -> paid', () => {
      assertInvalidTransition(CHARGE_STATUS.EXPIRED, CHARGE_STATUS.PAID)
    })

    it('rejects expired -> pending', () => {
      assertInvalidTransition(CHARGE_STATUS.EXPIRED, CHARGE_STATUS.PENDING)
    })

    it('rejects refunded -> pending', () => {
      assertInvalidTransition(CHARGE_STATUS.REFUNDED, CHARGE_STATUS.PENDING)
    })

    it('rejects refunded -> paid', () => {
      assertInvalidTransition(CHARGE_STATUS.REFUNDED, CHARGE_STATUS.PAID)
    })

    it('rejects failed -> paid', () => {
      assertInvalidTransition(CHARGE_STATUS.FAILED, CHARGE_STATUS.PAID)
    })

    it('rejects failed -> pending', () => {
      assertInvalidTransition(CHARGE_STATUS.FAILED, CHARGE_STATUS.PENDING)
    })

    it('rejects paid -> pending', () => {
      assertInvalidTransition(CHARGE_STATUS.PAID, CHARGE_STATUS.PENDING)
    })

    it('rejects paid -> expired', () => {
      assertInvalidTransition(CHARGE_STATUS.PAID, CHARGE_STATUS.EXPIRED)
    })
  })
})
