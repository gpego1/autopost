import { Link2 } from 'lucide-react'

export function Accounts() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Link2 className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Contas Conectadas</h1>
      </div>
      <p className="text-slate-400">Gerenciamento de contas sociais — em construção.</p>
    </div>
  )
}
