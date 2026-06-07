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
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <PenSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {isEdit ? 'Editar Post' : 'Novo Post'}
        </h1>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Título <span className="text-muted-foreground">(opcional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do post..."
            className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Conteúdo <span className="text-destructive">*</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Escreva o conteúdo do post..."
            rows={6}
            className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors text-sm resize-none"
          />
          <p className="text-muted-foreground text-xs mt-1 text-right">{content.length} caracteres</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Plataformas <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
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
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !isConnected
                      ? 'border-border bg-muted text-muted-foreground/50 cursor-not-allowed'
                      : isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {!isConnected && (
                    <span className="text-xs text-muted-foreground/50 ml-1 hidden sm:inline">(não conectado)</span>
                  )}
                </button>
              )
            })}
          </div>
          {accounts.length === 0 && (
            <p className="text-muted-foreground text-xs mt-2">
              Nenhuma conta conectada.{' '}
              <a href="/accounts" className="text-primary hover:underline">
                Conectar contas
              </a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            <Calendar className="w-4 h-4 inline-block mr-1 relative -top-px" />
            Data e hora de publicação{' '}
            <span className="text-muted-foreground text-xs">(opcional — deixe vazio para rascunho)</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors text-sm"
          />
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
