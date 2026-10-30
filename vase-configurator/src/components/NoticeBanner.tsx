import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNoticeStore } from '@/store/notice-store'

/** Strip under the top bar for one-off problems, e.g. a broken share link. */
export function NoticeBanner() {
  const message = useNoticeStore((s) => s.message)
  const dismiss = useNoticeStore((s) => s.dismiss)
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <Button variant="ghost" size="icon" className="size-7" onClick={dismiss} aria-label="Dismiss">
        <X />
      </Button>
    </div>
  )
}
