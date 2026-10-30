import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDesignStore, useIsDirty } from '@/store/design-store'
import { GalleryDialog } from './GalleryDialog'
import { ShareDialog } from './ShareDialog'

type SaveStatus = 'idle' | 'saved' | 'failed'

/** Design name, unsaved-changes dot, Save (also Ctrl/Cmd+S) and the gallery. */
export function DesignBar() {
  const name = useDesignStore((s) => s.name)
  const setName = useDesignStore((s) => s.setName)
  const save = useDesignStore((s) => s.save)
  const dirty = useIsDirty()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doSave = useCallback(() => {
    setStatus(save() ? 'saved' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), 2500)
  }, [save])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        doSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
      <div className="relative min-w-0">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Design name"
          className="h-8 w-28 truncate border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input focus-visible:border-input sm:w-52"
        />
        {dirty && (
          <span
            className="absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full bg-amber-500"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={doSave} title="Save (Ctrl+S)">
        {status === 'saved' ? <Check className="text-emerald-500" /> : <Save />}
        <span className="hidden sm:inline">{status === 'saved' ? 'Saved' : 'Save'}</span>
      </Button>
      {status === 'failed' && (
        <span className="text-xs text-destructive" role="alert">
          Couldn’t save — browser storage is full or blocked.
        </span>
      )}
      <GalleryDialog />
      <ShareDialog />
    </div>
  )
}
