import { RefreshCw } from 'lucide-react'

export default function LoadingCard({
  message = 'Loading workspace data...',
}: {
  message?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
      <p className="mt-3 text-xs font-medium text-slate-500">
        {message}
      </p>
    </div>
  )
}
