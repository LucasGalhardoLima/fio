import crypto from 'node:crypto'
import type {
  PaymentProvider,
  PixChargeResult,
  ChargeStatusResult,
  RefundResult,
  ConsentRequest,
  ConsentStatus,
} from './payment-provider.js'
import { NotFoundError } from '../lib/errors.js'

interface StoredCharge {
  txid: string
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paidAt?: Date
  endToEndId?: string
  pixKey: string
}

/**
 * In-memory mock payment provider for sandbox / test environment.
 * Stores charges in a Map; state can be manipulated via
 * simulatePayment / simulateFailure for sandbox test endpoints.
 */
interface StoredConsent {
  consentId: string
  status: 'pending' | 'authorized' | 'denied' | 'canceled'
}

export class MockPaymentProvider implements PaymentProvider {
  private readonly charges = new Map<string, StoredCharge>()
  private readonly consents = new Map<string, StoredConsent>()

  async createPixCharge(params: {
    amount: number
    txid: string
    expiresInSeconds: number
    pixKey: string
  }): Promise<PixChargeResult> {
    const { amount, txid, pixKey } = params

    this.charges.set(txid, {
      txid,
      amount,
      status: 'pending',
      pixKey,
    })

    return {
      qrCode: `MOCK_EMV_${txid}_${amount}`,
      qrCodeImage: `data:image/png;base64,MOCK_QR_IMAGE_${txid}`,
      copyPaste: `MOCK_EMV_${txid}_${amount}`,
      providerRef: txid,
    }
  }

  async getChargeStatus(providerRef: string): Promise<ChargeStatusResult> {
    const charge = this.charges.get(providerRef)
    if (!charge) {
      throw new NotFoundError(`Mock charge not found: ${providerRef}`)
    }

    return {
      status: charge.status,
      paidAt: charge.paidAt,
      endToEndId: charge.endToEndId,
    }
  }

  async refund(_endToEndId: string, _amount: number): Promise<RefundResult> {
    return {
      refundId: `mock_refund_${crypto.randomBytes(8).toString('hex')}`,
      status: 'completed',
    }
  }

  async createConsentRequest(params: {
    customerName: string
    customerTaxId: string
    amount: number
    interval: string
  }): Promise<ConsentRequest> {
    const consentId = `mock_consent_${crypto.randomBytes(8).toString('hex')}`
    this.consents.set(consentId, { consentId, status: 'pending' })
    return {
      consentId,
      authorizationUrl: `https://mock-bank.example.com/consent/${consentId}?name=${encodeURIComponent(params.customerName)}`,
    }
  }

  async getConsentStatus(consentId: string): Promise<ConsentStatus> {
    const consent = this.consents.get(consentId)
    if (!consent) {
      throw new NotFoundError(`Mock consent not found: ${consentId}`)
    }
    return { status: consent.status }
  }

  async createAutomaticCharge(params: {
    consentId: string
    amount: number
    scheduledDate: Date
  }): Promise<PixChargeResult> {
    const consent = this.consents.get(params.consentId)
    if (!consent || consent.status !== 'authorized') {
      throw new Error(`Consent ${params.consentId} is not authorized`)
    }
    const txid = `auto_${crypto.randomBytes(8).toString('hex')}`
    this.charges.set(txid, { txid, amount: params.amount, status: 'pending', pixKey: 'auto' })
    return {
      qrCode: '',
      qrCodeImage: '',
      copyPaste: '',
      providerRef: txid,
    }
  }

  simulateConsentApproval(consentId: string): void {
    const consent = this.consents.get(consentId)
    if (!consent) throw new NotFoundError(`Mock consent not found: ${consentId}`)
    consent.status = 'authorized'
  }

  simulateConsentDenial(consentId: string): void {
    const consent = this.consents.get(consentId)
    if (!consent) throw new NotFoundError(`Mock consent not found: ${consentId}`)
    consent.status = 'denied'
  }

  /**
   * Simulate a payment confirmation for sandbox testing.
   * Transitions the charge from pending to paid and generates a fake endToEndId.
   */
  simulatePayment(providerRef: string): void {
    const charge = this.charges.get(providerRef)
    if (!charge) {
      throw new NotFoundError(`Mock charge not found: ${providerRef}`)
    }
    if (charge.status !== 'pending') {
      throw new Error(`Cannot simulate payment: charge is ${charge.status}, expected pending`)
    }

    charge.status = 'paid'
    charge.paidAt = new Date()
    charge.endToEndId = `E${crypto.randomBytes(16).toString('hex')}`
  }

  /**
   * Simulate a payment failure for sandbox testing.
   * Transitions the charge from pending to failed.
   */
  simulateFailure(providerRef: string): void {
    const charge = this.charges.get(providerRef)
    if (!charge) {
      throw new NotFoundError(`Mock charge not found: ${providerRef}`)
    }
    if (charge.status !== 'pending') {
      throw new Error(`Cannot simulate failure: charge is ${charge.status}, expected pending`)
    }

    charge.status = 'failed'
  }
}
