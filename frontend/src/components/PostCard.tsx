import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Edit2, Facebook, Instagram, Linkedin, Loader2, Send, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import { useDeletePost, usePublishNow } from '@/hooks/usePosts'
import type { Platform, Post } from '@/types'

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  const iconClass = 'w-4 h-4'
  switch (platform) {
    case 'facebook':
      return <Facebook className={iconClass} />
    case 'instagram':
      return <Instagram className={iconClass} />
    case 'linkedin':
      return <Linkedin className={iconClass} />
    default:
      return null
  }
}

const platformColors: Record<Platform, string> = {
  facebook: 'text-blue-400',
  instagram: 'text-pink-400',
  linkedin: 'text-sky-400',
}

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  const navigate = useNavigate()
  const deletePost = useDeletePost()
  const publishNow = usePublishNow()

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Tem certeza que deseja excluir este post?')) {
      await deletePost.mutateAsync(post.id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/composer/${post.id}`)
  }

  const handlePublishNow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Publicar este post agora nas plataformas selecionadas?')) {
      await publishNow.mutateAsync(post.id)
    }
  }

  const contentPreview =
    post.content.length > 120
      ? post.content.substring(0, 120) + '...'
      : post.content

  return (
    <div
      className="bg-navy-800 border border-navy-600 rounded-xl p-4 hover:border-primary-500 transition-colors cursor-pointer group"
      onClick={() => navigate(`/composer/${post.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {post.title && (
            <h3 className="text-white font-semibold text-sm truncate mb-1">
              {post.title}
            </h3>
          )}
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
            {contentPreview}
          </p>
        </div>
        <StatusBadge status={post.status} className="shrink-0" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        {/* Platform icons */}
        <div className="flex items-center gap-1.5">
          {post.platforms.map((platform) => (
            <span
              key={platform}
              className={platformColors[platform as Platform] ?? 'text-slate-400'}
              title={platform}
            >
              <PlatformIcon platform={platform as Platform} />
            </span>
          ))}
        </div>

        {/* Scheduled time */}
        {post.scheduled_at && (
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {format(
                new Date(/Z|[+-]\d{2}:?\d{2}$/.test(post.scheduled_at) ? post.scheduled_at : post.scheduled_at + 'Z'),
                "dd MMM 'às' HH:mm",
                { locale: ptBR },
              )}
            </span>
          </div>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="mt-3 pt-3 border-t border-navy-600 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {(post.status === 'scheduled' || post.status === 'failed') && (
          <button
            onClick={handlePublishNow}
            disabled={publishNow.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {publishNow.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Publicar agora
          </button>
        )}
        <button
          onClick={handleEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-navy-600 rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Editar
        </button>
        <button
          onClick={handleDelete}
          disabled={deletePost.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </button>
      </div>
    </div>
  )
}
