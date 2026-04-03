'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'
import { useSession } from '@/components/session-provider'

interface Charge {
  id: string
  customer_id: string
  amount: number
  status: string
  created_at: string
}

interface ListResponse {
  data: Charge[]
  has_more: boolean
}

function formatBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  expired: 'bg-white/10 text-text-secondary',
  refunded: 'bg-purple-500/15 text-purple-400',
  partially_refunded: 'bg-purple-500/10 text-purple-300',
}

export default function ChargesPage() {
  const { token } = useSession()
  const [charges, setCharges] = useState<Charge[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/charges', { token })
      .then((res) => setCharges(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [token])

  if (error) {
    return <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Cobranças</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: (row) => row.id.slice(0, 8) },
          { key: 'customer_id', label: 'Cliente', render: (row) => row.customer_id.slice(0, 8) },
          { key: 'amount', label: 'Valor', render: (row) => formatBRL(row.amount) },
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
            key: 'created_at',
            label: 'Criado em',
            render: (row) => new Date(row.created_at).toLocaleDateString('pt-BR'),
          },
        ]}
        data={charges}
        emptyMessage="Nenhuma cobrança"
      />
    </div>
  )
}
