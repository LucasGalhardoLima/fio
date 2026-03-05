import fs from 'node:fs'
import https from 'node:https'
import type {
  PaymentProvider,
  PixChargeResult,
  ChargeStatusResult,
  RefundResult,
  ConsentRequest,
  ConsentStatus,
} from './payment-provider.js'
import { centavosToDecimal, decimalToCentavos } from '../lib/money.js'

interface EfiProviderConfig {
  clientId: string
  clientSecret: string
  pixKey: string
  certificatePath: string
  sandbox: boolean
}

interface EfiTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface EfiCobResponse {
  txid: string
  status: string
  loc: { id: number }
  valor: { original: string }
  horario?: { pagamento?: string }
  pix?: Array<{ endToEndId: string }>
}

interface EfiQrCodeResponse {
  qrcode: string
  imagemQrcode: string
}

interface EfiRefundResponse {
  id: string
  rtrId: string
  status: string
}

const PROD_BASE_URL = 'https://pix.api.efipay.com.br'
const SANDBOX_BASE_URL = 'https://pix-h.api.efipay.com.br'

// Refresh token 100s before actual expiry (3600s)
const TOKEN_REFRESH_BUFFER_MS = 100_000

/**
 * Efi Pay (formerly Gerencianet) PaymentProvider implementation.
 *
 * Uses mTLS for all API calls. The certificate is loaded from a PEM file.
 * OAuth2 tokens are cached and refreshed automatically before expiry.
 */
export class EfiProvider implements PaymentProvider {
  private readonly config: EfiProviderConfig
  private readonly baseUrl: string
  private readonly httpsAgent: https.Agent

  private accessToken: string | null = null
  private tokenExpiresAt = 0

  constructor(config: EfiProviderConfig) {
    this.config = config
    this.baseUrl = config.sandbox ? SANDBOX_BASE_URL : PROD_BASE_URL

    const cert = fs.readFileSync(config.certificatePath)
    this.httpsAgent = new https.Agent({
      cert,
      key: cert,
      rejectUnauthorized: !config.sandbox,
    })
  }

  async createPixCharge(params: {
    amount: number
    txid: string
    expiresInSeconds: number
    pixKey: string
  }): Promise<PixChargeResult> {
    const token = await this.getToken()

    // PUT /v2/cob/{txid}
    const cobBody = {
      calendario: { expiracao: params.expiresInSeconds },
      devedor: {},
      valor: { original: centavosToDecimal(params.amount) },
      chave: params.pixKey,
    }

    const cobResponse = await this.request<EfiCobResponse>(
      'PUT',
      `/v2/cob/${params.txid}`,
      token,
      cobBody,
    )

    // GET /v2/loc/{locId}/qrcode
    const qrResponse = await this.request<EfiQrCodeResponse>(
      'GET',
      `/v2/loc/${cobResponse.loc.id}/qrcode`,
      token,
    )

    return {
      qrCode: qrResponse.qrcode,
      qrCodeImage: qrResponse.imagemQrcode,
      copyPaste: qrResponse.qrcode,
      providerRef: cobResponse.txid,
    }
  }

  async getChargeStatus(providerRef: string): Promise<ChargeStatusResult> {
    const token = await this.getToken()

    const cob = await this.request<EfiCobResponse>(
      'GET',
      `/v2/cob/${providerRef}`,
      token,
    )

    const status = mapEfiStatus(cob.status)
    const paidAt = cob.horario?.pagamento ? new Date(cob.horario.pagamento) : undefined
    const endToEndId = cob.pix?.[0]?.endToEndId

    return { status, paidAt, endToEndId }
  }

  async refund(endToEndId: string, amount: number): Promise<RefundResult> {
    const token = await this.getToken()
    const refundId = generateRefundId()

    const response = await this.request<EfiRefundResponse>(
      'PUT',
      `/v2/pix/${endToEndId}/devolucao/${refundId}`,
      token,
      { valor: centavosToDecimal(amount) },
    )

    return {
      refundId: response.id || refundId,
      status: response.status === 'DEVOLVIDO' ? 'completed' : 'pending',
    }
  }

  async createConsentRequest(params: {
    customerName: string
    customerTaxId: string
    amount: number
    interval: string
  }): Promise<ConsentRequest> {
    const token = await this.getToken()
    const body = {
      pagador: { cpf: params.customerTaxId, nome: params.customerName },
      valor: { original: centavosToDecimal(params.amount) },
      periodicidade: mapIntervalToPeriodicidade(params.interval),
      chave: this.config.pixKey,
    }
    const response = await this.request<{ identificador: string; urlAutorizacao: string }>(
      'POST',
      '/v2/gn/automatico/consentimento',
      token,
      body,
    )
    return { consentId: response.identificador, authorizationUrl: response.urlAutorizacao }
  }

  async getConsentStatus(consentId: string): Promise<ConsentStatus> {
    const token = await this.getToken()
    const response = await this.request<{ status: string }>(
      'GET',
      `/v2/gn/automatico/consentimento/${consentId}`,
      token,
    )
    return { status: mapEfiConsentStatus(response.status) }
  }

  async createAutomaticCharge(params: {
    consentId: string
    amount: number
    scheduledDate: Date
  }): Promise<PixChargeResult> {
    const token = await this.getToken()
    const body = {
      consentimentoId: params.consentId,
      valor: { original: centavosToDecimal(params.amount) },
      dataAgendamento: params.scheduledDate.toISOString().slice(0, 10),
    }
    const response = await this.request<{ txid: string; loc: { id: number } }>(
      'POST',
      '/v2/gn/automatico/cobranca',
      token,
      body,
    )
    return {
      qrCode: '',
      qrCodeImage: '',
      copyPaste: '',
      providerRef: response.txid,
    }
  }

  /**
   * Get a valid OAuth2 access token, refreshing if expired.
   */
  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64')

    const url = `${this.baseUrl}/oauth/token`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
      // @ts-expect-error -- Node.js fetch supports dispatcher for custom agent
      dispatcher: this.httpsAgent,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Efi OAuth failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as EfiTokenResponse

    this.accessToken = data.access_token
    // Refresh 100s before expiry
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - TOKEN_REFRESH_BUFFER_MS

    return this.accessToken
  }

  /**
   * Make an authenticated request to the Efi API.
   */
  private async request<T>(
    method: string,
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // @ts-expect-error -- Node.js fetch supports dispatcher for custom agent
      dispatcher: this.httpsAgent,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Efi API error (${method} ${path}, ${response.status}): ${text}`)
    }

    return (await response.json()) as T
  }
}

/**
 * Map Efi charge status strings to our internal status.
 */
function mapEfiStatus(efiStatus: string): 'pending' | 'paid' | 'failed' | 'expired' {
  switch (efiStatus) {
    case 'ATIVA':
    case 'CONCLUIDA':
      // CONCLUIDA with pix[] means paid, but we check that separately via endToEndId
      return efiStatus === 'CONCLUIDA' ? 'paid' : 'pending'
    case 'REMOVIDA_PELO_USUARIO_RECEBEDOR':
    case 'REMOVIDA_PELO_PSP':
      return 'expired'
    default:
      return 'failed'
  }
}

/**
 * Generate a unique refund ID (alphanumeric, max 35 chars).
 */
function generateRefundId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `${timestamp}${random}`
}

function mapEfiConsentStatus(status: string): 'pending' | 'authorized' | 'denied' | 'canceled' {
  switch (status) {
    case 'AUTORIZADO':
      return 'authorized'
    case 'NEGADO':
      return 'denied'
    case 'CANCELADO':
    case 'CANCELADO_PELO_USUARIO':
      return 'canceled'
    default:
      return 'pending'
  }
}

function mapIntervalToPeriodicidade(interval: string): string {
  switch (interval) {
    case 'week':
      return 'SEMANAL'
    case 'month':
      return 'MENSAL'
    case 'year':
      return 'ANUAL'
    default:
      return 'MENSAL'
  }
}

// Re-export for tests
export { decimalToCentavos }
