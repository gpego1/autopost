import { AlertCircle, Calendar, CheckCircle2, Clock, LayoutDashboard, PenSquare, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PostCard } from '@/components/PostCard'
import { usePostsQuery } from '@/hooks/usePosts'

export function Dashboard() {
  const { data: posts = [], isLoading, isError } = usePostsQuery()

  const counts = {
    total: posts.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    done: posts.filter(p => p.status === 'done').length,
    failed: posts.filter(p => p.status === 'failed').length,
  }

  const recentPosts = posts.slice(0, 5)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <Link
          to="/composer"
          className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Post</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          label="Total de Posts"
          value={counts.total}
          icon={<PenSquare className="w-5 h-5" />}
          colorClass="text-muted-foreground"
        />
        <StatCard
          label="Agendados"
          value={counts.scheduled}
          icon={<Calendar className="w-5 h-5" />}
          colorClass="text-primary"
        />
        <StatCard
          label="Publicados"
          value={counts.done}
          icon={<CheckCircle2 className="w-5 h-5" />}
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Falharam"
          value={counts.failed}
          icon={<XCircle className="w-5 h-5" />}
          colorClass="text-destructive"
        />
      </div>

      <div>
        <h2 className="text-foreground font-semibold mb-4 text-sm sm:text-base">Posts Recentes</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 sm:py-16 bg-card border border-border rounded-lg">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">Erro ao carregar posts</p>
            <p className="text-muted-foreground text-sm">O servidor está temporariamente indisponível. Aguarde um instante e recarregue a página.</p>
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-card border border-border rounded-lg">
            <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-muted mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum post ainda.</p>
            <Link
              to="/composer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PenSquare className="w-4 h-4" />
              Criar primeiro post
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
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
  colorClass,
}: {
  label: string
  value: number
  icon: React.ReactNode
  colorClass: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-5 shadow-sm">
      <div className={`${colorClass} mb-3`}>{icon}</div>
      <div className="text-2xl sm:text-3xl font-bold text-card-foreground mb-1">{value}</div>
      <div className="text-muted-foreground text-xs sm:text-sm">{label}</div>
    </div>
  )
}
