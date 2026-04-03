import type { Charge } from '@fio-pay/shared'
import type { FioClient } from '../client.js'

export interface AdvanceTimeResult {
  billing_cycles_processed: number
  dunning_retries_processed: number
  charges_expired: number
}

export class TestResource {
  constructor(private readonly client: FioClient) {
    if (client.environment !== 'test') {
      throw new Error('Test resource is only available in sandbox mode (fio_test_ keys)')
    }
  }

  async simulatePayment(chargeId: string): Promise<Charge> {
    return this.client.post<Charge>(`/test/charges/${chargeId}/pay`)
  }

  async advanceTime(days: number): Promise<AdvanceTimeResult> {
    return this.client.post<AdvanceTimeResult>('/test/time/advance', { days })
  }
}
