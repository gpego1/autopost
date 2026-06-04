import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, Clock, PenSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PostCard } from '@/components/PostCard'
import { usePostsQuery } from '@/hooks/usePosts'
import type { Post } from '@/types'

function dayLabel(dayKey: string): string {
  const date = new Date(dayKey + 'T12:00:00')
  if (isToday(date)) return 'Hoje'
  if (isTomorrow(date)) return 'Amanhã'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
}

export function Calendar() {
  const { data: posts = [], isLoading } = usePostsQuery('scheduled')

  const grouped = posts.reduce<Record<string, Post[]>>((acc, post) => {
    if (!post.scheduled_at) return acc
    const key = post.scheduled_at.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(post)
    return acc
  }, {})

  const sortedDays = Object.keys(grouped).sort()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-primary-400" />
          <h1 className="text-2xl font-bold text-white">Calendário</h1>
        </div>
        <Link
          to="/composer"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          Novo Post
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-navy-800 border border-navy-600 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="text-center py-16 bg-navy-800 border border-navy-600 rounded-xl">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">Nenhum post agendado.</p>
          <Link
            to="/composer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            Agendar post
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDays.map(day => (
            <div key={day}>
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 capitalize">
                {dayLabel(day)}
              </h2>
              <div className="grid gap-4">
                {grouped[day].map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
