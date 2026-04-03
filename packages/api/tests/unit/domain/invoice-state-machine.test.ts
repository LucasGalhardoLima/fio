import { describe, it, expect } from 'vitest'
import { validateInvoiceTransition } from '../../../src/domain/invoice-state-machine.js'
import { INVOICE_STATUS } from '@fio-pay/shared'
import type { InvoiceStatus } from '@fio-pay/shared'

describe('Invoice State Machine', () => {
  describe('valid transitions', () => {
    it('allows draft -> open', () => {
      expect(() =>
        validateInvoiceTransition(INVOICE_STATUS.DRAFT, INVOICE_STATUS.OPEN),
      ).not.toThrow()
    })

    it('allows open -> paid', () => {
      expect(() =>
        validateInvoiceTransition(INVOICE_STATUS.OPEN, INVOICE_STATUS.PAID),
      ).not.toThrow()
    })

    it('allows open -> failed', () => {
      expect(() =>
        validateInvoiceTransition(INVOICE_STATUS.OPEN, INVOICE_STATUS.FAILED),
      ).not.toThrow()
    })

    it('allows open -> void', () => {
      expect(() =>
        validateInvoiceTransition(INVOICE_STATUS.OPEN, INVOICE_STATUS.VOID),
      ).not.toThrow()
    })
  })

  describe('invalid transitions', () => {
    const assertInvalidTransition = (
      from: InvoiceStatus,
      to: InvoiceStatus,
    ): void => {
      expect(() => validateInvoiceTransition(from, to)).toThrow()
      try {
        validateInvoiceTransition(from, to)
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).toContain(from)
        expect(err.message).toContain(to)
      }
    }

    it('rejects paid -> open', () => {
      assertInvalidTransition(INVOICE_STATUS.PAID, INVOICE_STATUS.OPEN)
    })

    it('rejects paid -> failed', () => {
      assertInvalidTransition(INVOICE_STATUS.PAID, INVOICE_STATUS.FAILED)
    })

    it('rejects failed -> open', () => {
      assertInvalidTransition(INVOICE_STATUS.FAILED, INVOICE_STATUS.OPEN)
    })

    it('rejects failed -> paid', () => {
      assertInvalidTransition(INVOICE_STATUS.FAILED, INVOICE_STATUS.PAID)
    })

    it('rejects void -> open', () => {
      assertInvalidTransition(INVOICE_STATUS.VOID, INVOICE_STATUS.OPEN)
    })

    it('rejects void -> paid', () => {
      assertInvalidTransition(INVOICE_STATUS.VOID, INVOICE_STATUS.PAID)
    })

    it('rejects draft -> paid (must go through open)', () => {
      assertInvalidTransition(INVOICE_STATUS.DRAFT, INVOICE_STATUS.PAID)
    })

    it('rejects draft -> failed (must go through open)', () => {
      assertInvalidTransition(INVOICE_STATUS.DRAFT, INVOICE_STATUS.FAILED)
    })

    it('rejects paid -> void', () => {
      assertInvalidTransition(INVOICE_STATUS.PAID, INVOICE_STATUS.VOID)
    })
  })
})
