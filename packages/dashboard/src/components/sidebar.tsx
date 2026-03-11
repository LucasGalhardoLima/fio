'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/components/session-provider'

const nav = [
  { label: 'Visão Geral', href: '/overview' },
  { label: 'Clientes', href: '/customers' },
  { label: 'Assinaturas', href: '/subscriptions' },
  { label: 'Cobranças', href: '/charges' },
  { label: 'Webhooks', href: '/webhooks' },
  { label: 'Configurações', href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useSession()

  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-bold text-indigo-600">Fio</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-gray-200 p-2">
        <button
          onClick={logout}
          className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
