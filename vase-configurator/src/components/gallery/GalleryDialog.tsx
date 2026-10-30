import { useRef, useState } from 'react'
import { Copy, FileDown, FilePlus2, Images, Pencil, Trash2, Upload } from 'lucide-react'
import { downloadFile, sanitizeFileName } from '@/export/export'
import type { VaseParams } from '@/model/params'
import { MAX_FILE_BYTES, parseDesignFile, toDesignFile } from '@/persistence/design-file'
import { useVaseStore } from '@/store/vase-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  browserStorage,
  deleteDesign,
  duplicateDesign,
  listDesigns,
  renameDesign,
  type SavedDesign,
} from '@/persistence/gallery'
import { useDesignStore, useIsDirty } from '@/store/design-store'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** What the user is being asked to confirm, if anything. */
type Pending =
  | { id: string; action: 'open' | 'delete' }
  | { id: 'new'; action: 'new' }
  | { id: 'import'; action: 'import'; name: string; params: VaseParams }
  | null

export function GalleryDialog() {
  const [open, setOpen] = useState(false)
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const currentId = useDesignStore((s) => s.id)
  const currentName = useDesignStore((s) => s.name)
  const openDesign = useDesignStore((s) => s.open)
  const newDesign = useDesignStore((s) => s.newDesign)
  const importDesign = useDesignStore((s) => s.importDesign)
  const setCurrentName = useDesignStore((s) => s.setName)
  const params = useVaseStore((s) => s.params)
  const dirty = useIsDirty()
  const available = browserStorage() !== null

  function exportJson() {
    downloadFile(toDesignFile(currentName, params), `${sanitizeFileName(currentName)}.json`, 'application/json')
  }

  function applyImport(name: string, imported: VaseParams) {
    if (importDesign(name, imported)) setOpen(false)
    else setError('That design could not be loaded.')
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be chosen again
    if (!file) return
    setError('')
    setPending(null)
    if (file.size > MAX_FILE_BYTES) return setError('That file is too large to be a design file.')
    const result = parseDesignFile(await file.text())
    if (!result.ok) return setError(result.error)
    if (dirty) setPending({ id: 'import', action: 'import', name: result.name, params: result.params })
    else applyImport(result.name, result.params)
  }

  const refresh = () => setDesigns(listDesigns())

  function onOpenChange(next: boolean) {
    setOpen(next)
    setRenaming(null)
    setPending(null)
    setError('')
    if (next) refresh()
  }

  function doOpen(id: string) {
    if (dirty && id !== currentId && pending?.id !== id) return setPending({ id, action: 'open' })
    if (openDesign(id)) setOpen(false)
    else setError('That design could not be opened — its data is damaged or from a newer version.')
  }

  function doNew() {
    if (dirty && pending?.action !== 'new') return setPending({ id: 'new', action: 'new' })
    newDesign()
    setOpen(false)
  }

  function commitRename() {
    if (!renaming) return
    if (renameDesign(renaming.id, renaming.name) && renaming.id === currentId) setCurrentName(renaming.name.trim())
    setRenaming(null)
    refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Your designs">
          <Images />
          <span className="hidden sm:inline">Gallery</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Your designs</DialogTitle>
          <DialogDescription>
            Saved in this browser only — clearing site data removes them. Use Export JSON for a backup or to share.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={doNew}>
            <FilePlus2 />
            {pending?.action === 'new' ? 'Discard unsaved changes and start new' : 'New design'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload />
            Import JSON…
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} title="Download the open design as a .json file">
            <FileDown />
            Export JSON
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileChosen}
            aria-label="Choose a design file"
          />
        </div>

        {pending?.action === 'import' && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 p-2 text-sm">
            <span>Import “{pending.name}”? Your unsaved changes will be lost.</span>
            <Button size="sm" className="h-7" onClick={() => applyImport(pending.name, pending.params)}>
              Discard changes & import
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {!available ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This browser is blocking site storage (private mode?), so designs can’t be saved here.
          </p>
        ) : designs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing saved yet. Press <span className="font-medium">Save</span> (or Ctrl+S) to keep the current vase.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {designs.map((d) => (
              <li key={d.id} className="flex flex-col overflow-hidden rounded-lg border">
                <button
                  type="button"
                  onClick={() => doOpen(d.id)}
                  className="relative aspect-square bg-muted/40"
                  aria-label={`Open ${d.name}`}
                >
                  {d.thumbnail ? (
                    <img src={d.thumbnail} alt="" className="size-full object-cover" />
                  ) : (
                    <Images className="m-auto size-8 text-muted-foreground" aria-hidden />
                  )}
                  {d.id === currentId && (
                    <span className="absolute top-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                      Open now
                    </span>
                  )}
                </button>

                <div className="space-y-1 p-2">
                  {renaming?.id === d.id ? (
                    <Input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: d.id, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      className="h-7 text-sm"
                      aria-label="New name"
                    />
                  ) : (
                    <div className="truncate text-sm font-medium" title={d.name}>
                      {d.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{dateFormat.format(d.updatedAt)}</div>

                  {pending && pending.id === d.id ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Button
                        size="sm"
                        variant={pending.action === 'delete' ? 'destructive' : 'default'}
                        className="h-7 text-xs"
                        onClick={() => {
                          if (pending.action === 'delete') {
                            deleteDesign(d.id)
                            setPending(null)
                            refresh()
                          } else doOpen(d.id)
                        }}
                      >
                        {pending.action === 'delete' ? 'Delete' : 'Discard changes & open'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPending(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 pt-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Rename"
                        aria-label={`Rename ${d.name}`}
                        onClick={() => setRenaming({ id: d.id, name: d.name })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Duplicate"
                        aria-label={`Duplicate ${d.name}`}
                        onClick={() => {
                          duplicateDesign(d.id)
                          refresh()
                        }}
                      >
                        <Copy />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-7 text-muted-foreground hover:text-destructive"
                        title="Delete"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => setPending({ id: d.id, action: 'delete' })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
