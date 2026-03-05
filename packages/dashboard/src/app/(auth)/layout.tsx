export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-600">Fio</h1>
          <p className="mt-1 text-sm text-gray-500">Billing para PIX</p>
        </div>
        {children}
      </div>
    </div>
  )
}
