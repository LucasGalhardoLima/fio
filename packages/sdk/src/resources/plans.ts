import type { Plan, PaginatedResponse } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface CreatePlanParams {
  name: string
  amount: number
  interval: 'week' | 'month' | 'year'
  trial_days?: number
  dunning_schedule?: number[]
  metadata?: Record<string, unknown>
}

export interface ListPlansParams {
  starting_after?: string
  limit?: number
  active?: boolean
}

export class Plans {
  constructor(private readonly client: FioClient) {}

  async create(params: CreatePlanParams): Promise<Plan> {
    return this.client.post<Plan>('/plans', params)
  }

  async get(id: string): Promise<Plan> {
    return this.client.get<Plan>(`/plans/${id}`)
  }

  async archive(id: string): Promise<Plan> {
    return this.client.del<Plan>(`/plans/${id}`)
  }

  async list(params?: ListPlansParams): Promise<PaginatedResponse<Plan>> {
    return this.client.get<PaginatedResponse<Plan>>('/plans', params)
  }
}
