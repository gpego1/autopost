import { clsx } from 'clsx'
import type { JobStatus, PostStatus } from '@/types'

type Status = PostStatus | JobStatus

const statusConfig: Record<Status, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-slate-700 text-slate-300 border-slate-600',
  },
  scheduled: {
    label: 'Agendado',
    className: 'bg-blue-900/60 text-blue-300 border-blue-700',
  },
  publishing: {
    label: 'Publicando',
    className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  },
  done: {
    label: 'Publicado',
    className: 'bg-green-900/60 text-green-300 border-green-700',
  },
  failed: {
    label: 'Falhou',
    className: 'bg-red-900/60 text-red-300 border-red-700',
  },
  pending: {
    label: 'Pendente',
    className: 'bg-slate-700 text-slate-300 border-slate-600',
  },
  running: {
    label: 'Executando',
    className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  },
  retrying: {
    label: 'Tentando novamente',
    className: 'bg-orange-900/60 text-orange-300 border-orange-700',
  },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-slate-700 text-slate-300 border-slate-600',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {status === 'publishing' || status === 'running' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      ) : null}
      {config.label}
    </span>
  )
}
