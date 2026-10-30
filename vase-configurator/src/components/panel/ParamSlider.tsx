import { useId, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatNumber, formatRange, formatValue, parseTyped } from '@/model/format'
import { NUMBER_PARAMS, type NumberParamKey } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'

/**
 * A labelled slider bound to one numeric parameter. Hover the label for the
 * range; click the value to type an exact number (Enter to apply, Esc to cancel).
 * The slider itself takes arrow keys, Page Up/Down for bigger steps, Home/End.
 */
export function ParamSlider({ param }: { param: NumberParamKey }) {
  const id = useId()
  const spec = NUMBER_PARAMS[param]
  const value = useVaseStore((s) => s.params[param])
  const setParam = useVaseStore((s) => s.setParam)
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const n = parseTyped(draft, spec.unit)
    if (n !== null) setParam(param, n) // the store clamps to the range and the printer
    setDraft(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={id} className="cursor-help text-xs font-normal text-muted-foreground">
              {spec.label}
            </Label>
          </TooltipTrigger>
          <TooltipContent side="left">{formatRange(spec)}</TooltipContent>
        </Tooltip>
        <input
          value={draft ?? formatValue(value, spec)}
          onFocus={(e) => {
            setDraft(formatNumber(value, spec))
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(null)
              e.currentTarget.blur()
            }
          }}
          inputMode="decimal"
          aria-label={`${spec.label} value`}
          title="Click to type an exact value"
          className="w-20 rounded border border-transparent bg-transparent px-1 text-right font-mono text-xs tabular-nums outline-none hover:border-input focus:border-ring"
        />
      </div>
      <Slider
        id={id}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={[value]}
        onValueChange={([v]) => setParam(param, v)}
        aria-label={spec.label}
        aria-valuetext={formatValue(value, spec)}
      />
    </div>
  )
}
