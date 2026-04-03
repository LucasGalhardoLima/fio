'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useSession } from '@/components/session-provider'

interface ApiKey {
  id: string
  key_prefix: string
  environment: string
  name: string | null
  revoked_at: string | null
  created_at: string
}

export default function SettingsPage() {
  const { token } = useSession()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)

  useEffect(() => {
    loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function loadKeys() {
    try {
      const res = await apiFetch<{ data: ApiKey[] }>('/v1/api-keys', { token })
      setKeys(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar chaves')
    }
  }

  async function handleGenerate(env: 'test' | 'live') {
    try {
      const res = await apiFetch<{ raw_key: string }>('/v1/api-keys', {
        method: 'POST',
        body: { environment: env },
        token,
      })
      setNewKey(res.raw_key)
      await loadKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar chave')
    }
  }

  async function handleRevoke(id: string) {
    try {
      await apiFetch(`/v1/api-keys/${id}/revoke`, { method: 'POST', token })
      await loadKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar chave')
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Configurações</h1>

      <div className="mb-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-medium text-text-primary">Chaves de API</h2>

        {error && (
          <p className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-2 text-sm text-red-400">{error}</p>
        )}

        {newKey && (
          <div className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 p-4">
            <p className="text-sm font-medium text-green-400">
              Nova chave gerada — copie agora, não será exibida novamente:
            </p>
            <code className="mt-1 block break-all text-xs text-green-300">{newKey}</code>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 text-xs text-green-400 underline"
            >
              Entendi
            </button>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => handleGenerate('test')}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-bg hover:bg-accent-hover"
          >
            Nova chave de teste
          </button>
          <button
            onClick={() => handleGenerate('live')}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
          >
            Nova chave de produção
          </button>
        </div>

        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-md border border-border-subtle p-3"
            >
              <div>
                <code className="text-sm text-text-primary">{key.key_prefix}...</code>
                <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  key.environment === 'test' ? 'bg-blue-500/15 text-blue-400' : 'bg-white/10 text-text-secondary'
                }`}>
                  {key.environment}
                </span>
                {key.revoked_at && (
                  <span className="ml-2 inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                    revogada
                  </span>
                )}
                {key.name && (
                  <span className="ml-2 text-xs text-text-tertiary">{key.name}</span>
                )}
              </div>
              {!key.revoked_at && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Revogar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
