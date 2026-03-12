'use client'

interface TimelineEvent {
  id: string
  event_type: string
  entity_type: string
  entity_id: string
  data: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

interface EventTimelineProps {
  events: TimelineEvent[]
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-text-secondary">Nenhum evento registrado</p>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const isAgent = Boolean(event.metadata?.agent_id)
        return (
          <div key={event.id} className="flex gap-3 rounded-md border border-border p-3">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-accent" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {event.event_type}
                </span>
                {isAgent && (
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
                    agent
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {event.entity_type} {event.entity_id.slice(0, 8)}
              </p>
              <p className="text-xs text-text-tertiary">
                {new Date(event.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
