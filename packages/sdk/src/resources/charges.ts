import type { Charge, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface CreateChargeParams {
  customer_id: string
  amount: number
  expires_in?: number
  description?: string
  metadata?: Record<string, unknown>
}

export interface RefundChargeParams {
  amount?: number
}

export interface ListChargesParams {
  starting_after?: string
  limit?: number
  status?: string
  customer_id?: string
}

export class Charges {
  constructor(private readonly client: FioClient) {}

  async create(params: CreateChargeParams): Promise<Charge> {
    return this.client.post<Charge>('/charges', params)
  }

  async get(id: string): Promise<Charge> {
    return this.client.get<Charge>(`/charges/${id}`)
  }

  async refund(id: string, params?: RefundChargeParams): Promise<Charge> {
    return this.client.post<Charge>(`/charges/${id}/refund`, params)
  }

  async list(params?: ListChargesParams): Promise<PaginatedResponse<Charge>> {
    return this.client.get<PaginatedResponse<Charge>>('/charges', params)
  }
}
