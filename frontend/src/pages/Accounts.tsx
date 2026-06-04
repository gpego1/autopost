import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')
    const platform = sessionStorage.getItem('oauth_platform') as Platform | null

    if (oauthError) {
      setCallbackStatus({ type: 'error', message: 'Autorização negada pelo usuário.' })
      setSearchParams({})
      return
    }

    if (code && platform) {
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
          setCallbackStatus({
            type: 'error',
            message: e?.response?.data?.detail ?? 'Erro ao conectar conta.',
          })
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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link2 className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Contas Conectadas</h1>
      </div>

      {callbackLoading && (
        <div className="mb-6 flex items-center gap-3 bg-navy-800 border border-navy-600 rounded-lg p-4 text-slate-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Conectando conta...
        </div>
      )}

      {callbackStatus && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-lg p-4 text-sm ${
            callbackStatus.type === 'success'
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
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
            <div key={i} className="h-28 bg-navy-800 border border-navy-600 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <PlatformSection
            title="Meta (Facebook & Instagram)"
            icon={<Facebook className="w-5 h-5 text-blue-400" />}
            accounts={metaAccounts}
            onConnect={handleConnectMeta}
            onDisconnect={id => disconnect.mutate(id)}
            loading={metaOAuth.isPending || disconnect.isPending}
          />

          <PlatformSection
            title="LinkedIn"
            icon={<Linkedin className="w-5 h-5 text-sky-400" />}
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
  if (platform === 'facebook') return <Facebook className="w-4 h-4 text-blue-400" />
  if (platform === 'instagram') return <Instagram className="w-4 h-4 text-pink-400" />
  return <Linkedin className="w-4 h-4 text-sky-400" />
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
    <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-white font-semibold text-sm">{title}</h2>
        </div>
        <button
          onClick={onConnect}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-700 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Conectar
        </button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma conta conectada.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="flex items-center justify-between bg-navy-700 rounded-lg px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <PlatformIcon platform={acc.platform} />
                <div>
                  <p className="text-white text-sm font-medium">{acc.account_name}</p>
                  <p className="text-slate-500 text-xs capitalize">{acc.platform}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium ${acc.is_active ? 'text-green-400' : 'text-red-400'}`}
                >
                  {acc.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => onDisconnect(acc.id)}
                  disabled={loading}
                  title="Desconectar"
                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20 transition-colors disabled:opacity-50"
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
