import { clsx } from 'clsx'
import type { JobStatus, PostStatus } from '@/types'

type Status = PostStatus | JobStatus

const statusConfig: Record<Status, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-muted text-muted-foreground border-border',
  },
  scheduled: {
    label: 'Agendado',
    className: 'bg-primary/10 text-primary border-primary/30',
  },
  publishing: {
    label: 'Publicando',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50',
  },
  done: {
    label: 'Publicado',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50',
  },
  failed: {
    label: 'Falhou',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  pending: {
    label: 'Pendente',
    className: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    label: 'Executando',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50',
  },
  retrying: {
    label: 'Tentando novamente',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/50',
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
