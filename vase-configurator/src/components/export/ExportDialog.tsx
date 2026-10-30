import { useId, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vaseSize } from '@/geometry/bounds'
import { exportResolution, meshResolution, stlBytes, triangleCount } from '@/geometry/vase-mesh'
import { downloadFile, sanitizeFileName } from '@/export/export'
import { exportFile } from '@/export/export-client'
import { usePreview } from '@/hooks/use-preview'
import { MATERIALS } from '@/model/materials'
import { PRINTERS } from '@/model/printers'
import { useDesignStore } from '@/store/design-store'
import { useVaseStore } from '@/store/vase-store'

const count = (n: number) => n.toLocaleString('en-US')
const fileSize = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`)

type Format = 'stl' | '3dm'
type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; format: Format; message: string }
  | { kind: 'saved'; fileName: string }
  | { kind: 'error'; message: string }

export function ExportDialog() {
  const nameId = useId()
  const params = useVaseStore((s) => s.params)
  const warnings = usePreview().analysis.issues.filter((i) => i.severity === 'warning')
  const [name, setName] = useState('vase')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const res = exportResolution(params)
  const grid = meshResolution(params, res)
  const triangles = triangleCount(params, res)
  const size = vaseSize(params)
  const baseName = sanitizeFileName(name)
  const busy = status.kind === 'busy'

  async function run(format: Format) {
    const fileName = `${baseName}.${format}`
    setStatus({ kind: 'busy', format, message: 'Generating…' })
    try {
      // Built in a worker, so the page stays responsive however large the file
      const bytes = await exportFile(format, params, baseName, (stage) =>
        setStatus({
          kind: 'busy',
          format,
          message: stage === 'loading-rhino' ? 'Loading Rhino library…' : 'Generating…',
        }),
      )
      downloadFile(bytes, fileName, format === 'stl' ? 'model/stl' : 'application/octet-stream')
      setStatus({ kind: 'saved', fileName })
    } catch (error) {
      console.error(error)
      setStatus({
        kind: 'error',
        message: format === '3dm' ? 'Could not create the .3dm file. Check your connection and try again.' : 'Export failed.',
      })
    }
  }

  const buttonContent = (format: Format, label: string) =>
    status.kind === 'busy' && status.format === format ? (
      <>
        <Loader2 className="animate-spin" />
        {status.message}
      </>
    ) : (
      <>
        <Download />
        {label}
      </>
    )

  return (
    <Dialog
      onOpenChange={(open) => {
        setStatus({ kind: 'idle' })
        // Suggest the design's name each time the dialog opens
        if (open) setName(useDesignStore.getState().name)
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Export">
          <Download />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Millimetres, Z up. STL for your slicer; .3dm to keep working in Rhino (Mesh, Surface and Curves
            layers).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>File name</Label>
            <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="font-mono">
              Ø {size.diameter.toFixed(1)} × {size.height.toFixed(1)} mm
            </dd>
            <dt className="text-muted-foreground">Print</dt>
            <dd>
              {params.printMode === 'vaseMode' ? 'Vase mode (solid body)' : `Solid wall, ${params.wallThickness} mm`} ·{' '}
              {MATERIALS[params.material].label} · {PRINTERS[params.printerPreset].label}
            </dd>
            <dt className="text-muted-foreground">Mesh</dt>
            <dd className="font-mono">
              {grid.segmentsVertical} × {grid.segmentsRadial} · {count(triangles)} triangles
            </dd>
            <dt className="text-muted-foreground">STL</dt>
            <dd className="font-mono">≈ {fileSize(stlBytes(triangles))}</dd>
          </dl>

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" aria-hidden />
                {warnings.length === 1 ? '1 print warning' : `${warnings.length} print warnings`}
              </div>
              <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                {warnings.map((w) => (
                  <li key={w.id}>{w.title}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">You can still export.</p>
            </div>
          )}

          <p className="min-h-5 text-sm" aria-live="polite">
            {status.kind === 'saved' && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Check className="size-4 text-emerald-500" aria-hidden />
                Saved {status.fileName}
              </span>
            )}
            {status.kind === 'error' && <span className="text-destructive">{status.message}</span>}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => run('3dm')} disabled={busy}>
            {buttonContent('3dm', 'Download .3dm')}
          </Button>
          <Button onClick={() => run('stl')} disabled={busy}>
            {buttonContent('stl', 'Download STL')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
