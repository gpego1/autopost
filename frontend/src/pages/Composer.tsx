import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, Facebook, Instagram, Linkedin, Loader2, PenSquare, Save, Send } from 'lucide-react'
import { useAccountsQuery } from '@/hooks/useAccounts'
import { useCreatePost, usePostQuery, useSchedulePost, useUpdatePost } from '@/hooks/usePosts'
import type { Platform } from '@/types'

const PLATFORMS: { id: Platform; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'facebook', label: 'Facebook', Icon: Facebook },
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
]

export function Composer() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { data: existingPost } = usePostQuery(id)
  const { data: accounts = [] } = useAccountsQuery()
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const schedulePost = useSchedulePost()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const connectedPlatforms = new Set(accounts.filter(a => a.is_active).map(a => a.platform))

  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title ?? '')
      setContent(existingPost.content)
      setPlatforms(existingPost.platforms)
      if (existingPost.scheduled_at) {
        const utc = new Date(existingPost.scheduled_at)
        const local = new Date(utc.getTime() - utc.getTimezoneOffset() * 60000)
        setScheduledAt(local.toISOString().slice(0, 16))
      }
    }
  }, [existingPost])

  const togglePlatform = (platform: Platform) => {
    setPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    )
  }

  const validate = () => {
    if (!content.trim()) { setError('O conteúdo é obrigatório.'); return false }
    if (platforms.length === 0) { setError('Selecione ao menos uma plataforma.'); return false }
    setError(null)
    return true
  }

  const handleSaveDraft = async () => {
    if (!validate()) return
    try {
      if (isEdit) {
        await updatePost.mutateAsync({ id: id!, input: { title, content, platforms } })
      } else {
        await createPost.mutateAsync({ title, content, platforms })
      }
      navigate('/dashboard')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erro ao salvar rascunho.')
    }
  }

  const handleSchedule = async () => {
    if (!validate()) return
    if (!scheduledAt) { setError('Escolha a data e hora de publicação.'); return }
    try {
      let postId = id
      if (!isEdit) {
        const created = await createPost.mutateAsync({ title, content, platforms })
        postId = created.id
      } else {
        await updatePost.mutateAsync({ id: id!, input: { title, content, platforms } })
      }
      await schedulePost.mutateAsync({
        id: postId!,
        scheduled_at: new Date(scheduledAt).toISOString(),
      })
      navigate('/calendar')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erro ao agendar post.')
    }
  }

  const isPending = createPost.isPending || updatePost.isPending || schedulePost.isPending

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <PenSquare className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? 'Editar Post' : 'Novo Post'}
        </h1>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Título <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do post..."
            className="w-full bg-navy-800 border border-navy-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Conteúdo <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Escreva o conteúdo do post..."
            rows={6}
            className="w-full bg-navy-800 border border-navy-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 text-sm resize-none"
          />
          <p className="text-slate-500 text-xs mt-1 text-right">{content.length} caracteres</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Plataformas <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-3 flex-wrap">
            {PLATFORMS.map(({ id: pid, label, Icon }) => {
              const isConnected = connectedPlatforms.has(pid)
              const isSelected = platforms.includes(pid)
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => isConnected && togglePlatform(pid)}
                  disabled={!isConnected}
                  title={!isConnected ? `Conecte sua conta ${label} primeiro` : undefined}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !isConnected
                      ? 'border-navy-600 bg-navy-800 text-slate-600 cursor-not-allowed'
                      : isSelected
                        ? 'border-primary-500 bg-primary-700/40 text-white'
                        : 'border-navy-600 bg-navy-800 text-slate-400 hover:border-primary-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {!isConnected && (
                    <span className="text-xs text-slate-600 ml-1">(não conectado)</span>
                  )}
                </button>
              )
            })}
          </div>
          {accounts.length === 0 && (
            <p className="text-slate-500 text-xs mt-2">
              Nenhuma conta conectada.{' '}
              <a href="/accounts" className="text-primary-400 hover:underline">
                Conectar contas
              </a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            <Calendar className="w-4 h-4 inline-block mr-1 relative -top-px" />
            Data e hora de publicação{' '}
            <span className="text-slate-500">(opcional — deixe vazio para salvar como rascunho)</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            className="w-full bg-navy-800 border border-navy-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm [color-scheme:dark]"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 border border-navy-600 bg-navy-800 text-slate-300 hover:text-white hover:border-primary-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Rascunho
          </button>
          <button
            onClick={handleSchedule}
            disabled={isPending || !scheduledAt}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {scheduledAt ? 'Agendar' : 'Agendar (escolha data)'}
          </button>
        </div>
      </div>
    </div>
  )
}
