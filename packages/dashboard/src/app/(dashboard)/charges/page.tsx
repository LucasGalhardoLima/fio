'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'

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
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-700',
  refunded: 'bg-purple-100 text-purple-700',
  partially_refunded: 'bg-purple-50 text-purple-600',
}

export default function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/charges', { token: '' })
      .then((res) => setCharges(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [])

  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Cobranças</h1>
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
