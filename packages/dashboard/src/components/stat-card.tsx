interface StatCardProps {
  label: string
  value: string
  detail?: string
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
      {detail && <p className="mt-1 text-xs text-text-tertiary">{detail}</p>}
    </div>
  )
}
