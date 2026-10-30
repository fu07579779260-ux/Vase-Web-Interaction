import { useId } from 'react'
import { Info, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MATERIALS, type Material } from '@/model/materials'
import { ENUM_PARAMS } from '@/model/params'
import { PRINTERS } from '@/model/printers'
import { useVaseStore } from '@/store/vase-store'

export function MaterialControls() {
  const colorId = useId()
  const material = useVaseStore((s) => s.params.material)
  const color = useVaseStore((s) => s.params.materialColor)
  const nozzle = useVaseStore((s) => s.params.nozzleDiameter)
  const printerKind = useVaseStore((s) => PRINTERS[s.params.printerPreset].kind)
  const applyMaterial = useVaseStore((s) => s.applyMaterial)
  const setParam = useVaseStore((s) => s.setParam)

  const spec = MATERIALS[material]
  const minWall = spec.minWall(nozzle)

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={material}
        onValueChange={(v) => v && applyMaterial(v as Material)}
        className="grid w-full grid-cols-4 gap-1"
        aria-label="Material"
      >
        {ENUM_PARAMS.material.map((m) => {
          const usable = MATERIALS[m].kind === printerKind
          return (
            <ToggleGroupItem
              key={m}
              value={m}
              disabled={!usable}
              title={usable ? MATERIALS[m].label : `Not for ${printerKind === 'fdm' ? 'FDM' : 'resin'} printers`}
              className="rounded-md! border text-xs data-[state=on]:border-primary"
            >
              {MATERIALS[m].label}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Min wall</dt>
        <dd className="font-mono">
          {+minWall.toFixed(2)} mm <span className="text-muted-foreground">({spec.minWallRule})</span>
        </dd>
        <dt className="text-muted-foreground">Max overhang</dt>
        <dd className="font-mono">{spec.maxOverhang}° from vertical</dd>
        <dt className="text-muted-foreground">Finish</dt>
        <dd>{spec.finishLabel}</dd>
      </dl>

      <div className="flex items-center gap-2">
        <Label htmlFor={colorId} className="text-xs font-normal text-muted-foreground">
          Colour
        </Label>
        <input
          id={colorId}
          type="color"
          value={color}
          onChange={(e) => setParam('materialColor', e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <span className="font-mono text-xs">{color}</span>
        {color.toLowerCase() !== spec.defaultColor && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={() => setParam('materialColor', spec.defaultColor)}
            aria-label="Reset colour"
            title="Reset colour"
          >
            <RotateCcw />
          </Button>
        )}
      </div>

      {spec.notes.length > 0 && (
        <ul className="space-y-1">
          {spec.notes.map((note) => (
            <li key={note} className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
