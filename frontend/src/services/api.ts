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

// Response interceptor: on 401 try to refresh the session first;
// only sign out and redirect if there is truly no valid session.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
