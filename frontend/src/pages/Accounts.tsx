import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Facebook,
  Instagram,
  Linkedin,
  Link2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ACCOUNTS_KEY, useAccountsQuery, useDisconnectAccount, useLinkedInOAuthUrl, useMetaOAuthUrl } from '@/hooks/useAccounts'
import { connectLinkedInCallback, connectMetaCallback } from '@/services/accountsApi'
import type { Platform, SocialAccount } from '@/types'

const REDIRECT_URI = `${window.location.origin}/accounts`

type CallbackStatus = { type: 'success' | 'error'; message: string } | null

export function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: accounts = [], isLoading } = useAccountsQuery()
  const disconnect = useDisconnectAccount()
  const metaOAuth = useMetaOAuthUrl(REDIRECT_URI)
  const linkedInOAuth = useLinkedInOAuthUrl(REDIRECT_URI)
  const queryClient = useQueryClient()
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>(null)
  const [callbackLoading, setCallbackLoading] = useState(false)
  const callbackFiredRef = useRef(false)

  useEffect(() => {
    if (callbackFiredRef.current) return

    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')
    const platform = sessionStorage.getItem('oauth_platform') as Platform | null

    if (oauthError) {
      callbackFiredRef.current = true
      setCallbackStatus({ type: 'error', message: 'Autorização negada pelo usuário.' })
      setSearchParams({})
      return
    }

    if (code && platform) {
      callbackFiredRef.current = true
      sessionStorage.removeItem('oauth_platform')
      setCallbackLoading(true)
      setSearchParams({})

      const finish = async () => {
        try {
          if (platform === 'facebook' || platform === 'instagram') {
            await connectMetaCallback(code, REDIRECT_URI)
          } else {
            await connectLinkedInCallback(code, REDIRECT_URI)
          }
          await queryClient.invalidateQueries({ queryKey: [ACCOUNTS_KEY] })
          const name = platform === 'linkedin' ? 'LinkedIn' : 'Meta (Facebook/Instagram)'
          setCallbackStatus({ type: 'success', message: `Conta ${name} conectada com sucesso!` })
        } catch (e: any) {
          const status = e?.response?.status
          const detail = e?.response?.data?.detail
          let message = 'Erro ao conectar conta.'
          if (status === 401) {
            message = 'Sessão expirada. Faça login novamente e tente conectar a conta.'
          } else if (typeof detail === 'string') {
            message = detail
          }
          setCallbackStatus({ type: 'error', message })
        } finally {
          setCallbackLoading(false)
        }
      }
      finish()
    }
  }, [])

  const handleConnectMeta = () => {
    sessionStorage.setItem('oauth_platform', 'facebook')
    metaOAuth.mutate()
  }

  const handleConnectLinkedIn = () => {
    sessionStorage.setItem('oauth_platform', 'linkedin')
    linkedInOAuth.mutate()
  }

  const facebookAccounts = accounts.filter(a => a.platform === 'facebook')
  const instagramAccounts = accounts.filter(a => a.platform === 'instagram')
  const linkedinAccounts = accounts.filter(a => a.platform === 'linkedin')
  const metaAccounts = [...facebookAccounts, ...instagramAccounts]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Contas Conectadas</h1>
      </div>

      {callbackLoading && (
        <div className="mb-6 flex items-center gap-3 bg-card border border-border rounded-lg p-4 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Conectando conta...
        </div>
      )}

      {callbackStatus && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-lg p-4 text-sm ${
            callbackStatus.type === 'success'
              ? 'bg-emerald-100 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700/50 dark:text-emerald-300'
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          }`}
        >
          {callbackStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {callbackStatus.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-28 bg-card border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <PlatformSection
            title="Meta (Facebook & Instagram)"
            icon={<Facebook className="w-5 h-5 text-blue-500" />}
            accounts={metaAccounts}
            onConnect={handleConnectMeta}
            onDisconnect={id => disconnect.mutate(id)}
            loading={metaOAuth.isPending || disconnect.isPending}
          />

          <PlatformSection
            title="LinkedIn"
            icon={<Linkedin className="w-5 h-5 text-sky-500" />}
            accounts={linkedinAccounts}
            onConnect={handleConnectLinkedIn}
            onDisconnect={id => disconnect.mutate(id)}
            loading={linkedInOAuth.isPending || disconnect.isPending}
          />
        </div>
      )}
    </div>
  )
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'facebook') return <Facebook className="w-4 h-4 text-blue-500" />
  if (platform === 'instagram') return <Instagram className="w-4 h-4 text-pink-500" />
  return <Linkedin className="w-4 h-4 text-sky-500" />
}

function PlatformSection({
  title,
  icon,
  accounts,
  onConnect,
  onDisconnect,
  loading,
}: {
  title: string
  icon: React.ReactNode
  accounts: SocialAccount[]
  onConnect: () => void
  onDisconnect: (id: string) => void
  loading: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-card-foreground font-semibold text-sm">{title}</h2>
        </div>
        <button
          onClick={onConnect}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Conectar
        </button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma conta conectada.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <PlatformIcon platform={acc.platform} />
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{acc.account_name}</p>
                  <p className="text-muted-foreground text-xs capitalize">{acc.platform}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                <span
                  className={`text-xs font-medium ${acc.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                >
                  {acc.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => onDisconnect(acc.id)}
                  disabled={loading}
                  title="Desconectar"
                  className="text-destructive hover:text-destructive p-1.5 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
