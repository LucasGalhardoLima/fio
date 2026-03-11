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
      <h1 className="mb-6 text-xl font-semibold">Configurações</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Chaves de API</h2>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

        {newKey && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              Nova chave gerada — copie agora, não será exibida novamente:
            </p>
            <code className="mt-1 block break-all text-xs text-green-700">{newKey}</code>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 text-xs text-green-600 underline"
            >
              Entendi
            </button>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => handleGenerate('test')}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
          >
            Nova chave de teste
          </button>
          <button
            onClick={() => handleGenerate('live')}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900"
          >
            Nova chave de produção
          </button>
        </div>

        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-md border border-gray-100 p-3"
            >
              <div>
                <code className="text-sm">{key.key_prefix}...</code>
                <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  key.environment === 'test' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {key.environment}
                </span>
                {key.revoked_at && (
                  <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    revogada
                  </span>
                )}
                {key.name && (
                  <span className="ml-2 text-xs text-gray-500">{key.name}</span>
                )}
              </div>
              {!key.revoked_at && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-xs text-red-600 hover:underline"
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
