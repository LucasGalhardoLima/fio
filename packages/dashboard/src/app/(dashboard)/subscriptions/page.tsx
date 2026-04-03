'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'
import { useSession } from '@/components/session-provider'

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
  active: 'bg-green-500/15 text-green-400',
  trialing: 'bg-blue-500/15 text-blue-400',
  past_due: 'bg-yellow-500/15 text-yellow-400',
  canceled: 'bg-red-500/15 text-red-400',
  paused: 'bg-white/10 text-text-secondary',
}

export default function SubscriptionsPage() {
  const { token } = useSession()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/subscriptions', { token })
      .then((res) => setSubs(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [token])

  if (error) {
    return <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Assinaturas</h1>
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
