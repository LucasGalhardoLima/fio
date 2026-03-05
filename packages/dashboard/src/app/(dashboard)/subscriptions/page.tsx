'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'

interface Subscription {
  id: string
  customer_id: string
  plan_id: string
  status: string
  current_period_end: string
  created_at: string
}

interface ListResponse {
  data: Subscription[]
  has_more: boolean
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  canceled: 'bg-red-100 text-red-700',
  paused: 'bg-gray-100 text-gray-700',
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/subscriptions', { token: '' })
      .then((res) => setSubs(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [])

  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Assinaturas</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: (row) => row.id.slice(0, 8) },
          { key: 'customer_id', label: 'Cliente', render: (row) => row.customer_id.slice(0, 8) },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[row.status] ?? ''}`}>
                {row.status}
              </span>
            ),
          },
          {
            key: 'current_period_end',
            label: 'Próximo ciclo',
            render: (row) => new Date(row.current_period_end).toLocaleDateString('pt-BR'),
          },
        ]}
        data={subs}
        emptyMessage="Nenhuma assinatura"
      />
    </div>
  )
}
