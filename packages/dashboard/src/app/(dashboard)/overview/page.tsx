'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/stat-card'
import { apiFetch } from '@/lib/api'
import { useSession } from '@/components/session-provider'

interface Metrics {
  mrr: number
  active_subscriptions: number
  churn_rate: number
  total_charges_today: number
}

function formatBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

export default function OverviewPage() {
  const { token } = useSession()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<Metrics>('/v1/metrics', { token })
      .then(setMetrics)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar métricas')
      })
  }, [token])

  if (error) {
    return (
      <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{error}</div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Visão Geral</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={metrics ? formatBRL(metrics.mrr) : '—'}
        />
        <StatCard
          label="Assinaturas Ativas"
          value={metrics ? String(metrics.active_subscriptions) : '—'}
        />
        <StatCard
          label="Taxa de Churn"
          value={metrics ? `${metrics.churn_rate.toFixed(1)}%` : '—'}
        />
        <StatCard
          label="Cobranças Hoje"
          value={metrics ? String(metrics.total_charges_today) : '—'}
        />
      </div>
    </div>
  )
}
