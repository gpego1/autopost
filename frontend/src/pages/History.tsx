import { AlertCircle, Clock, PenSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PostCard } from '@/components/PostCard'
import { usePostsQuery } from '@/hooks/usePosts'
import type { PostStatus } from '@/types'

const HISTORY_STATUSES: PostStatus[] = ['done', 'failed', 'publishing']

export function History() {
  const { data: allPosts = [], isLoading, isError } = usePostsQuery()

  const historyPosts = allPosts.filter(p => HISTORY_STATUSES.includes(p.status))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Histórico</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-card border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-12 sm:py-16 bg-card border border-border rounded-lg">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-medium mb-1">Erro ao carregar histórico</p>
          <p className="text-muted-foreground text-sm">O servidor está temporariamente indisponível. Aguarde um instante e recarregue a página.</p>
        </div>
      ) : historyPosts.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-card border border-border rounded-lg">
          <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-muted mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Nenhuma publicação ainda.</p>
          <p className="text-muted-foreground/70 text-sm mb-4">Posts publicados e falhos aparecerão aqui.</p>
          <Link
            to="/composer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            Criar post
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {historyPosts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
