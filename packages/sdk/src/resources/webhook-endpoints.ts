import type { WebhookEndpoint, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface CreateWebhookEndpointParams {
  url: string
  event_types?: string[]
}

export interface ListWebhookEndpointsParams {
  starting_after?: string
  limit?: number
}

export class WebhookEndpoints {
  constructor(private readonly client: FioClient) {}

  async create(params: CreateWebhookEndpointParams): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>('/webhook-endpoints', params)
  }

  async get(id: string): Promise<WebhookEndpoint> {
    return this.client.get<WebhookEndpoint>(`/webhook-endpoints/${id}`)
  }

  async delete(id: string): Promise<void> {
    await this.client.del<void>(`/webhook-endpoints/${id}`)
  }

  async list(params?: ListWebhookEndpointsParams): Promise<PaginatedResponse<WebhookEndpoint>> {
    return this.client.get<PaginatedResponse<WebhookEndpoint>>('/webhook-endpoints', params)
  }
}
