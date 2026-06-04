import { Clock, PenSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PostCard } from '@/components/PostCard'
import { usePostsQuery } from '@/hooks/usePosts'
import type { PostStatus } from '@/types'

const HISTORY_STATUSES: PostStatus[] = ['done', 'failed', 'publishing']

export function History() {
  const { data: allPosts = [], isLoading } = usePostsQuery()

  const historyPosts = allPosts.filter(p => HISTORY_STATUSES.includes(p.status))

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Histórico</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-navy-800 border border-navy-600 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : historyPosts.length === 0 ? (
        <div className="text-center py-16 bg-navy-800 border border-navy-600 rounded-xl">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">Nenhuma publicação ainda.</p>
          <p className="text-slate-500 text-sm mb-4">Posts publicados e falhos aparecerão aqui.</p>
          <Link
            to="/composer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            Criar post
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {historyPosts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
