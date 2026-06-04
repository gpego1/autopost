import { Calendar, CheckCircle2, Clock, LayoutDashboard, PenSquare, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PostCard } from '@/components/PostCard'
import { usePostsQuery } from '@/hooks/usePosts'

export function Dashboard() {
  const { data: posts = [], isLoading } = usePostsQuery()

  const counts = {
    total: posts.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    done: posts.filter(p => p.status === 'done').length,
    failed: posts.filter(p => p.status === 'failed').length,
  }

  const recentPosts = posts.slice(0, 5)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-primary-400" />
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </div>
        <Link
          to="/composer"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          Novo Post
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total de Posts"
          value={counts.total}
          icon={<PenSquare className="w-5 h-5" />}
          color="text-slate-300"
        />
        <StatCard
          label="Agendados"
          value={counts.scheduled}
          icon={<Calendar className="w-5 h-5" />}
          color="text-blue-400"
        />
        <StatCard
          label="Publicados"
          value={counts.done}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-green-400"
        />
        <StatCard
          label="Falharam"
          value={counts.failed}
          icon={<XCircle className="w-5 h-5" />}
          color="text-red-400"
        />
      </div>

      <div>
        <h2 className="text-white font-semibold mb-4">Posts Recentes</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-navy-800 border border-navy-600 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="text-center py-16 bg-navy-800 border border-navy-600 rounded-xl">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">Nenhum post ainda.</p>
            <Link
              to="/composer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
            >
              <PenSquare className="w-4 h-4" />
              Criar primeiro post
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {recentPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
      <div className={`${color} mb-3`}>{icon}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  )
}
