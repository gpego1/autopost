import api from './api'
import type { SocialAccount, OAuthUrlResponse } from '@/types'

export const getAccounts = async (): Promise<SocialAccount[]> => {
  const { data } = await api.get<SocialAccount[]>('/accounts')
  return data
}

export const disconnectAccount = async (id: string): Promise<void> => {
  await api.delete(`/accounts/${id}`)
}

export const getMetaOAuthUrl = async (redirectUri: string): Promise<OAuthUrlResponse> => {
  const { data } = await api.get<OAuthUrlResponse>('/accounts/oauth/meta', {
    params: { redirect_uri: redirectUri },
  })
  return data
}

export const getLinkedInOAuthUrl = async (redirectUri: string): Promise<OAuthUrlResponse> => {
  const { data } = await api.get<OAuthUrlResponse>('/accounts/oauth/linkedin', {
    params: { redirect_uri: redirectUri },
  })
  return data
}

export const connectMetaCallback = async (
  code: string,
  redirectUri: string
): Promise<SocialAccount[]> => {
  const { data } = await api.post<SocialAccount[]>('/accounts/connect/meta/callback', {
    code,
    redirect_uri: redirectUri,
  })
  return data
}

export const connectLinkedInCallback = async (
  code: string,
  redirectUri: string
): Promise<SocialAccount> => {
  const { data } = await api.post<SocialAccount>('/accounts/connect/linkedin/callback', {
    code,
    redirect_uri: redirectUri,
  })
  return data
}
