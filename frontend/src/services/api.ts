import axios, { AxiosError } from 'axios'
import { supabase } from '@/lib/supabaseClient'

const API_URL = import.meta.env.VITE_API_URL as string || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Supabase Bearer token to every request
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: on 401 try to refresh the session and retry once;
// only sign out and redirect if there is truly no valid session.
let isSigningOut = false

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }
    if (error.response?.status === 401 && !originalRequest?._retry && !isSigningOut) {
      originalRequest!._retry = true
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        // Token was refreshed — retry the original request with fresh token
        originalRequest!.headers!['Authorization'] = `Bearer ${session.access_token}`
        return api(originalRequest!)
      }
      // No session at all — sign out once and redirect
      isSigningOut = true
      try {
        await supabase.auth.signOut()
      } finally {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
