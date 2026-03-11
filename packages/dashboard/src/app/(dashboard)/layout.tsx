import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { SessionProvider } from '@/components/session-provider'
import { getSessionToken } from '@/lib/session'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const token = await getSessionToken()

  if (!token) {
    redirect('/login')
  }

  return (
    <SessionProvider token={token}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SessionProvider>
  )
}
