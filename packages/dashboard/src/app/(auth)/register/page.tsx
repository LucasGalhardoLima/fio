'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface RegisterResponse {
  account: { id: string; name: string; email: string }
  api_keys: { test: string; live: string }
}

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [keys, setKeys] = useState<{ test: string; live: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      })
      setKeys(result.api_keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  if (keys) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Conta criada!</h2>
        <p className="text-sm text-gray-600">
          Guarde suas chaves de API. Elas não serão exibidas novamente.
        </p>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-500">Chave de teste</label>
            <code className="mt-1 block break-all rounded-md bg-gray-100 p-2 text-xs">
              {keys.test}
            </code>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Chave de produção</label>
            <code className="mt-1 block break-all rounded-md bg-gray-100 p-2 text-xs">
              {keys.live}
            </code>
          </div>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Ir para login
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Criar conta</h2>
      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Senha</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Criando...' : 'Criar conta'}
      </button>
      <p className="text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
