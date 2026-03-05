'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { apiFetch } from '@/lib/api'

interface Customer {
  id: string
  name: string
  email: string
  tax_id: string
  created_at: string
}

interface ListResponse {
  data: Customer[]
  has_more: boolean
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<ListResponse>('/v1/customers', { token: '' })
      .then((res) => setCustomers(res.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
  }, [])

  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Clientes</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Nome' },
          { key: 'email', label: 'Email' },
          { key: 'tax_id', label: 'CPF/CNPJ' },
          {
            key: 'created_at',
            label: 'Criado em',
            render: (row) => new Date(row.created_at).toLocaleDateString('pt-BR'),
          },
        ]}
        data={customers}
        emptyMessage="Nenhum cliente cadastrado"
      />
    </div>
  )
}
