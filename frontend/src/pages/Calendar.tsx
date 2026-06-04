import { Calendar as CalendarIcon } from 'lucide-react'

export function Calendar() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <CalendarIcon className="w-6 h-6 text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Calendário</h1>
      </div>
      <p className="text-slate-400">Visualização de agendamentos — em construção.</p>
    </div>
  )
}
