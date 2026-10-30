import { ENUM_PARAMS } from '@/model/params'
import { EASINGS, EASING_LABELS, type TwistEasing } from '@/geometry/twist'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'
import { ParamSlider } from './ParamSlider'

const SIZE = 32
const PAD = 4
const SAMPLES = 20

/** Easing curve: x = height (bottom → top), y = rotation, drawn bottom-left to top-right. */
function curvePath(easing: TwistEasing): string {
  const f = EASINGS[easing]
  const span = SIZE - 2 * PAD
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES
    return `${(PAD + t * span).toFixed(2)},${(SIZE - PAD - f(t) * span).toFixed(2)}`
  })
  return `M${pts.join('L')}`
}

const OPTIONS: IconOption<TwistEasing>[] = ENUM_PARAMS.twistEasing.map((e) => ({
  value: e,
  label: EASING_LABELS[e],
  path: curvePath(e),
}))

export function TwistControls() {
  const twist = useVaseStore((s) => s.params.twist)
  const twistEasing = useVaseStore((s) => s.params.twistEasing)
  const sectionShape = useVaseStore((s) => s.params.sectionShape)
  const patternType = useVaseStore((s) => s.params.patternType)
  const setParam = useVaseStore((s) => s.setParam)

  const invisible = twist !== 0 && sectionShape === 'circle' && patternType === 'none'

  return (
    <div className="space-y-4">
      <ParamSlider param="twist" />
      <IconToggleGroup
        value={twistEasing}
        options={OPTIONS}
        onChange={(v) => setParam('twistEasing', v)}
        viewBox={{ w: SIZE, h: SIZE }}
        ariaLabel="Twist easing"
        variant="stroke"
      />
      {invisible && (
        <p className="text-xs text-muted-foreground">
          A round section looks the same when twisted. Pick a polygon or star to see it.
        </p>
      )}
    </div>
  )
}
