import { ENUM_PARAMS } from '@/model/params'
import { PATTERN_LABELS, type PatternType } from '@/geometry/pattern'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'
import { ParamSlider } from './ParamSlider'

const SIZE = 32
const LO = 6
const HI = 26

/** Line icon per pattern, as if the vase surface were unrolled flat. */
function iconPath(type: PatternType): string {
  switch (type) {
    case 'none':
      return `M${LO},${LO}H${HI}V${HI}H${LO}Z`
    case 'waves':
      return [10, 16, 22]
        .map((y) => {
          const pts = Array.from({ length: 21 }, (_, i) => {
            const x = LO + (i / 20) * (HI - LO)
            return `${x.toFixed(1)},${(y + 2.5 * Math.sin((i / 20) * Math.PI * 4)).toFixed(1)}`
          })
          return `M${pts.join('L')}`
        })
        .join('')
    case 'ribs':
      return [8, 13, 18, 23].map((x) => `M${x},${LO}V${HI}`).join('')
    case 'spiral':
      return [0, 6, 12, 18].map((o) => `M${LO + o - 6},${HI}L${LO + o + 6},${LO}`).join('')
  }
}

const OPTIONS: IconOption<PatternType>[] = ENUM_PARAMS.patternType.map((t) => ({
  value: t,
  label: PATTERN_LABELS[t],
  path: iconPath(t),
}))

export function PatternControls() {
  const patternType = useVaseStore((s) => s.params.patternType)
  const setParam = useVaseStore((s) => s.setParam)

  return (
    <div className="space-y-4">
      <IconToggleGroup
        value={patternType}
        options={OPTIONS}
        onChange={(v) => setParam('patternType', v)}
        viewBox={{ w: SIZE, h: SIZE }}
        ariaLabel="Surface pattern"
        variant="stroke"
      />
      {patternType !== 'none' && (
        <>
          <ParamSlider param="patternAmplitude" />
          <ParamSlider param="patternCountAround" />
          {patternType === 'waves' && <ParamSlider param="patternCountVertical" />}
          {patternType === 'spiral' && <ParamSlider param="spiralTurns" />}
          <ParamSlider param="patternFadeBottom" />
        </>
      )}
    </div>
  )
}
