import type { Invoice, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface ListInvoicesParams {
  starting_after?: string
  limit?: number
  subscription_id?: string
  status?: string
}

export class Invoices {
  constructor(private readonly client: FioClient) {}

  async get(id: string): Promise<Invoice> {
    return this.client.get<Invoice>(`/invoices/${id}`)
  }

  async list(params?: ListInvoicesParams): Promise<PaginatedResponse<Invoice>> {
    return this.client.get<PaginatedResponse<Invoice>>('/invoices', params)
  }
}
