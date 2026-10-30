import { useMemo } from 'react'
import { ENUM_PARAMS } from '@/model/params'
import { SECTION_LABELS, sectionFunction, snapRadialSegments, type SectionShape } from '@/geometry/section'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'
import { ParamSlider } from './ParamSlider'

const SIZE = 32
const ICON_SEGMENTS = 96

/** Top-down outline of a section, using the user's current sides / depth / rounding. */
function outlinePath(params: Parameters<typeof sectionFunction>[0]): string {
  const s = sectionFunction(params)
  const n = snapRadialSegments(params, ICON_SEGMENTS)
  const c = SIZE / 2
  const scale = c - 1
  const pts = Array.from({ length: n }, (_, j) => {
    const theta = (2 * Math.PI * j) / n
    // Rotate so a corner points up, which reads better at icon size
    const a = theta - Math.PI / 2
    return `${(c + s(theta) * scale * Math.cos(a)).toFixed(2)},${(c + s(theta) * scale * Math.sin(a)).toFixed(2)}`
  })
  return `M${pts.join('L')}Z`
}

export function SectionPicker() {
  const sectionShape = useVaseStore((s) => s.params.sectionShape)
  const sides = useVaseStore((s) => s.params.sides)
  const starDepth = useVaseStore((s) => s.params.starDepth)
  const cornerRounding = useVaseStore((s) => s.params.cornerRounding)
  const setParam = useVaseStore((s) => s.setParam)

  const options: IconOption<SectionShape>[] = useMemo(
    () =>
      ENUM_PARAMS.sectionShape.map((shape) => ({
        value: shape,
        label: SECTION_LABELS[shape],
        // Icons exaggerate depth / rounding so the shapes stay distinguishable at icon size
        path: outlinePath({
          sectionShape: shape,
          sides,
          starDepth: Math.max(starDepth, 0.4),
          cornerRounding: Math.max(cornerRounding, 0.3),
        }),
      })),
    [sides, starDepth, cornerRounding],
  )

  return (
    <div className="space-y-4">
      <IconToggleGroup
        value={sectionShape}
        options={options}
        onChange={(v) => setParam('sectionShape', v)}
        viewBox={{ w: SIZE, h: SIZE }}
        ariaLabel="Cross-section shape"
      />
      {sectionShape !== 'circle' && <ParamSlider param="sides" />}
      {sectionShape === 'star' && <ParamSlider param="starDepth" />}
      {sectionShape === 'roundedPolygon' && <ParamSlider param="cornerRounding" />}
    </div>
  )
}
