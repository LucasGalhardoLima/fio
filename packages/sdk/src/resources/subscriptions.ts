import type { Subscription, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface CreateSubscriptionParams {
  customer_id: string
  plan_id: string
  pix_automatico?: boolean
  metadata?: Record<string, unknown>
}

export interface CancelSubscriptionParams {
  cancel_at_period_end?: boolean
}

export interface ListSubscriptionsParams {
  starting_after?: string
  limit?: number
  status?: string
  customer_id?: string
}

export class Subscriptions {
  constructor(private readonly client: FioClient) {}

  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    return this.client.post<Subscription>('/subscriptions', params)
  }

  async get(id: string): Promise<Subscription> {
    return this.client.get<Subscription>(`/subscriptions/${id}`)
  }

  async cancel(id: string, params?: CancelSubscriptionParams): Promise<Subscription> {
    return this.client.post<Subscription>(`/subscriptions/${id}/cancel`, params)
  }

  async pause(id: string): Promise<Subscription> {
    return this.client.post<Subscription>(`/subscriptions/${id}/pause`)
  }

  async resume(id: string): Promise<Subscription> {
    return this.client.post<Subscription>(`/subscriptions/${id}/resume`)
  }

  async list(params?: ListSubscriptionsParams): Promise<PaginatedResponse<Subscription>> {
    return this.client.get<PaginatedResponse<Subscription>>('/subscriptions', params)
  }
}
