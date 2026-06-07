import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    // Get the current session on mount; catch errors so loading never stays true
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (mounted) {
          setState({ user: session?.user ?? null, session, loading: false })
        }
      })
      .catch((err) => {
        console.error('Auth session error:', err)
        if (mounted) {
          setState({ user: null, session: null, loading: false })
        }
      })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setState({ user: session?.user ?? null, session, loading: false })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/email-confirmed`,
      },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut()
  }

  return {
    ...state,
    signIn,
    signUp,
    signOut,
  }
}
