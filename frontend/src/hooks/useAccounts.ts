import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disconnectAccount,
  getAccounts,
  getLinkedInOAuthUrl,
  getMetaOAuthUrl,
} from '@/services/accountsApi'
import type { OAuthUrlResponse, SocialAccount } from '@/types'

export const ACCOUNTS_KEY = 'accounts'

export function useAccountsQuery() {
  return useQuery<SocialAccount[]>({
    queryKey: [ACCOUNTS_KEY],
    queryFn: getAccounts,
  })
}

export function useDisconnectAccount() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: disconnectAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] })
    },
  })
}

export function useMetaOAuthUrl(redirectUri: string) {
  return useMutation<OAuthUrlResponse, Error, void>({
    mutationFn: () => getMetaOAuthUrl(redirectUri),
    onSuccess: (data) => {
      window.location.href = data.authorization_url
    },
  })
}

export function useLinkedInOAuthUrl(redirectUri: string) {
  return useMutation<OAuthUrlResponse, Error, void>({
    mutationFn: () => getLinkedInOAuthUrl(redirectUri),
    onSuccess: (data) => {
      window.location.href = data.authorization_url
    },
  })
}
