/**
 * Payment provider interface.
 *
 * All amounts in centavos (integer). Providers handle conversion
 * to/from decimal at the boundary via centavosToDecimal / decimalToCentavos.
 */

export interface PixChargeResult {
  qrCode: string // EMV copia-e-cola string
  qrCodeImage: string // Base64 PNG data URI
  copyPaste: string // User-facing alias for qrCode
  providerRef: string // Provider-specific reference (txid for Efi)
}

export interface ChargeStatusResult {
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paidAt?: Date
  endToEndId?: string // Required for refunds
}

export interface RefundResult {
  refundId: string
  status: 'pending' | 'completed'
}

export interface ConsentRequest {
  consentId: string
  authorizationUrl: string
}

export interface ConsentStatus {
  status: 'pending' | 'authorized' | 'denied' | 'canceled'
}

export interface PaymentProvider {
  createPixCharge(params: {
    amount: number // centavos
    txid: string
    expiresInSeconds: number
    pixKey: string
  }): Promise<PixChargeResult>

  getChargeStatus(providerRef: string): Promise<ChargeStatusResult>

  refund(endToEndId: string, amount: number): Promise<RefundResult>

  // Pix Automatico (optional, implemented in Phase 7)
  createConsentRequest?(params: {
    customerName: string
    customerTaxId: string
    amount: number
    interval: string
  }): Promise<ConsentRequest>

  getConsentStatus?(consentId: string): Promise<ConsentStatus>

  createAutomaticCharge?(params: {
    consentId: string
    amount: number
    scheduledDate: Date
  }): Promise<PixChargeResult>
}
