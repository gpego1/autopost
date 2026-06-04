import { PenSquare } from 'lucide-react'

export function Composer() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <PenSquare className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Novo Post</h1>
      </div>
      <p className="text-slate-400">Compositor de posts — em construção.</p>
    </div>
  )
}
