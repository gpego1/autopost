import { LayoutDashboard } from 'lucide-react'

export function Dashboard() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </div>
      <p className="text-slate-400">Resumo de posts e estatísticas — em construção.</p>
    </div>
  )
}
