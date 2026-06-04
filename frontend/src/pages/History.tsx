import { Clock } from 'lucide-react'

export function History() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Histórico</h1>
      </div>
      <p className="text-slate-400">Histórico de publicações — em construção.</p>
    </div>
  )
}
