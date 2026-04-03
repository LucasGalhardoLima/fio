import type { Customer, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface CreateCustomerParams {
  name: string
  email: string
  tax_id: string
  tax_id_type: 'cpf' | 'cnpj'
  metadata?: Record<string, unknown>
}

export interface UpdateCustomerParams {
  name?: string
  email?: string
  metadata?: Record<string, unknown>
}

export interface ListCustomersParams {
  starting_after?: string
  limit?: number
  email?: string
}

export class Customers {
  constructor(private readonly client: FioClient) {}

  async create(params: CreateCustomerParams): Promise<Customer> {
    return this.client.post<Customer>('/customers', params)
  }

  async get(id: string): Promise<Customer> {
    return this.client.get<Customer>(`/customers/${id}`)
  }

  async update(id: string, params: UpdateCustomerParams): Promise<Customer> {
    return this.client.put<Customer>(`/customers/${id}`, params)
  }

  async delete(id: string): Promise<void> {
    await this.client.del<void>(`/customers/${id}`)
  }

  async list(params?: ListCustomersParams): Promise<PaginatedResponse<Customer>> {
    return this.client.get<PaginatedResponse<Customer>>('/customers', params)
  }
}
