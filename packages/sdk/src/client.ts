import type { ErrorResponse } from '@fio-pay/shared'
import {
  FioError,
  FioValidationError,
  FioAuthError,
  FioNotFoundError,
  FioRateLimitError,
  FioConflictError,
} from './errors.js'

export interface FioOptions {
  apiKey: string
  baseUrl?: string
}

export class FioClient {
  readonly apiKey: string
  readonly baseUrl: string
  readonly environment: 'test' | 'live'

  constructor(options: FioOptions) {
    this.apiKey = options.apiKey
    this.environment = options.apiKey.startsWith('fio_test_') ? 'test' : 'live'
    this.baseUrl = options.baseUrl ?? 'https://api.fio.com.br/v1'
  }

  async get<T>(path: string, params?: object): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    return this.request<T>('GET', url.toString())
  }

  async post<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('POST', `${this.baseUrl}${path}`, body)
  }

  async put<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('PUT', `${this.baseUrl}${path}`, body)
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', `${this.baseUrl}${path}`)
  }

  private async request<T>(method: string, url: string, body?: object): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = (await response.json()) as ErrorResponse
      throw this.createError(errorBody, response.status)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  private createError(body: ErrorResponse, status: number): FioError {
    switch (status) {
      case 401:
        return new FioAuthError(body)
      case 404:
        return new FioNotFoundError(body)
      case 409:
        return new FioConflictError(body)
      case 422:
        return new FioValidationError(body)
      case 429:
        return new FioRateLimitError(body)
      default:
        return new FioError(body, status)
    }
  }
}
