'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'
import { useSession } from '@/components/session-provider'

interface WebhookDelivery {
  id: string
  webhook_endpoint_id: string
  event_id: string
  status: string
  attempts: number
  response_status_code: number | null
  response_time_ms: number | null
  created_at: string
}

interface ListResponse {
  data: WebhookDelivery[]
  has_more: boolean
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function WebhooksPage() {
  const { token } = useSession()
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/webhook-deliveries', { token })
      .then((res) => setDeliveries(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [token])

  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Webhook Deliveries</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: (row) => row.id.slice(0, 8) },
          { key: 'event_id', label: 'Evento', render: (row) => row.event_id.slice(0, 8) },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[row.status] ?? ''}`}>
                {row.status}
              </span>
            ),
          },
          { key: 'attempts', label: 'Tentativas' },
          {
            key: 'response_status_code',
            label: 'HTTP',
            render: (row) => row.response_status_code ? String(row.response_status_code) : '—',
          },
          {
            key: 'response_time_ms',
            label: 'Tempo (ms)',
            render: (row) => row.response_time_ms ? `${row.response_time_ms}ms` : '—',
          },
        ]}
        data={deliveries}
        emptyMessage="Nenhuma entrega de webhook"
      />
    </div>
  )
}
