import { CheckCircle2, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function EmailConfirmed() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard'), 3000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">AutoPost</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Email confirmado!</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sua conta foi ativada com sucesso. Redirecionando para o dashboard...
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Ir para o Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
