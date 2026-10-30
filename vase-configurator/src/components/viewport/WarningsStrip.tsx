import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react'
import { usePreview } from '@/hooks/use-preview'
import { cn } from '@/lib/utils'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Badge over the viewport summarising print issues; expands into the full list. */
export function WarningsStrip() {
  const { issues } = usePreview().analysis
  // Start expanded on wide screens; on phones it would cover most of the vase
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  const warnings = issues.filter((i) => i.severity === 'warning')
  const notes = issues.filter((i) => i.severity === 'info')

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1.5 text-xs text-emerald-600 backdrop-blur dark:text-emerald-400">
        <CheckCircle2 className="size-4" aria-hidden />
        No print issues found
      </div>
    )
  }

  const summary = [
    warnings.length > 0 && plural(warnings.length, 'warning'),
    notes.length > 0 && plural(notes.length, 'note'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="w-full max-w-sm rounded-md border bg-background/85 text-xs shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left font-medium',
          warnings.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        )}
      >
        {warnings.length > 0 ? <AlertTriangle className="size-4" aria-hidden /> : <Info className="size-4" aria-hidden />}
        {summary}
        <ChevronDown className={cn('ml-auto size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul className="max-h-56 space-y-2 overflow-y-auto border-t px-3 py-2" aria-live="polite">
          {[...warnings, ...notes].map((issue) => (
            <li key={issue.id} className="flex gap-2">
              {issue.severity === 'warning' ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-label="Warning" />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Note" />
              )}
              <div>
                <div>{issue.title}</div>
                {issue.detail && <div className="text-muted-foreground">{issue.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
