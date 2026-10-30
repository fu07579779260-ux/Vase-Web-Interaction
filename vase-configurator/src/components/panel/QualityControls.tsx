import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { exportResolution, meshResolution, stlBytes, triangleCount } from '@/geometry/vase-mesh'
import { usePreview } from '@/hooks/use-preview'
import { ENUM_PARAMS, type QualityPreset } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import { ParamSlider } from './ParamSlider'

const LABELS: Record<QualityPreset, string> = {
  draft: 'Draft',
  normal: 'Normal',
  fine: 'Fine',
  custom: 'Custom',
}

// Above this, previewing at export quality gets sluggish on a typical laptop
const SLOW_PREVIEW_TRIANGLES = 1_500_000

const count = (n: number) => n.toLocaleString('en-US')

function fileSize(bytes: number) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`
}

export function QualityControls() {
  const switchId = useId()
  const params = useVaseStore((s) => s.params)
  const setParam = useVaseStore((s) => s.setParam)
  const previewTriangles = usePreview().mesh.indices.length / 3

  const requested = exportResolution(params)
  const actual = meshResolution(params, requested)
  const exportTriangles = triangleCount(params, requested)
  const raised =
    actual.segmentsVertical > requested.segmentsVertical || actual.segmentsRadial > requested.segmentsRadial

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={params.qualityPreset}
        onValueChange={(v) => v && setParam('qualityPreset', v as QualityPreset)}
        className="grid w-full grid-cols-4 gap-1"
        aria-label="Export quality"
      >
        {ENUM_PARAMS.qualityPreset.map((q) => (
          <ToggleGroupItem key={q} value={q} className="rounded-md! border text-xs data-[state=on]:border-primary">
            {LABELS[q]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {params.qualityPreset === 'custom' && (
        <>
          <ParamSlider param="segmentsVertical" />
          <ParamSlider param="segmentsRadial" />
        </>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Export</dt>
        <dd className="font-mono">
          {count(exportTriangles)} triangles · STL ≈ {fileSize(stlBytes(exportTriangles))}
        </dd>
        <dt className="text-muted-foreground">Grid</dt>
        <dd className="font-mono">
          {actual.segmentsVertical} × {actual.segmentsRadial}
        </dd>
        <dt className="text-muted-foreground">Preview</dt>
        <dd className="font-mono">{count(previewTriangles)} triangles</dd>
      </dl>

      {raised && (
        <p className="text-xs text-muted-foreground">
          Raised from {requested.segmentsVertical} × {requested.segmentsRadial} so the pattern, section corners
          and lip come out clean.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={switchId} className="text-xs font-normal text-muted-foreground">
          Preview at export quality
        </Label>
        <Switch
          id={switchId}
          checked={params.previewAtExportQuality}
          onCheckedChange={(v) => setParam('previewAtExportQuality', v)}
        />
      </div>
      {params.previewAtExportQuality && exportTriangles > SLOW_PREVIEW_TRIANGLES && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {count(exportTriangles)} triangles may make the preview slow.
        </p>
      )}
    </div>
  )
}
