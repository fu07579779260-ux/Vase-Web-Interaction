import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { vaseSize } from '@/geometry/bounds'
import { ENUM_PARAMS } from '@/model/params'
import { PRINTERS, isCustomPrinter, type PrinterKind, type PrinterPreset } from '@/model/printers'
import { useVaseStore } from '@/store/vase-store'
import { cn } from '@/lib/utils'
import { ParamSlider } from './ParamSlider'

// Drop trailing zeros: 218.88 stays, 256.00 → 256
const mm = (n: number) => `${+n.toFixed(2)}`

const GROUPS: { kind: PrinterKind; label: string }[] = [
  { kind: 'fdm', label: 'FDM' },
  { kind: 'resin', label: 'Resin' },
]

// Within this many mm of a limit, the readout says so
const AT_LIMIT_MM = 0.5

export function PrinterControls() {
  const params = useVaseStore((s) => s.params)
  const applyPrinterPreset = useVaseStore((s) => s.applyPrinterPreset)

  const preset = params.printerPreset
  const spec = PRINTERS[preset]
  const custom = isCustomPrinter(preset)
  const bed = Math.min(params.buildX, params.buildY)
  const size = vaseSize(params)
  const atLimit = size.diameter >= bed - AT_LIMIT_MM || size.height >= params.buildZ - AT_LIMIT_MM

  return (
    <div className="space-y-4">
      <Select value={preset} onValueChange={(v) => applyPrinterPreset(v as PrinterPreset)}>
        <SelectTrigger className="w-full" aria-label="Printer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map((g) => (
            <SelectGroup key={g.kind}>
              <SelectLabel>{g.label}</SelectLabel>
              {ENUM_PARAMS.printerPreset
                .filter((p) => PRINTERS[p].kind === g.kind)
                .map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRINTERS[p].label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {custom ? (
        <div className="space-y-4">
          <ParamSlider param="buildX" />
          <ParamSlider param="buildY" />
          <ParamSlider param="buildZ" />
          {spec.kind === 'fdm' ? <ParamSlider param="nozzleDiameter" /> : <ParamSlider param="xyResolution" />}
        </div>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          {mm(params.buildX)} × {mm(params.buildY)} × {mm(params.buildZ)} mm ·{' '}
          {spec.kind === 'fdm' ? `${params.nozzleDiameter} mm nozzle` : `${params.xyResolution} µm XY`}
        </p>
      )}

      <div
        className={cn(
          'rounded-md border px-3 py-2 text-xs',
          atLimit ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        <div className="font-mono">
          Vase Ø {size.diameter.toFixed(1)} × {size.height.toFixed(1)} mm
        </div>
        <div>
          {atLimit
            ? 'At the printer limit: sliders stop here.'
            : `Fits within Ø ${mm(bed)} × ${mm(params.buildZ)} mm`}
        </div>
      </div>
    </div>
  )
}
