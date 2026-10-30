import { ENUM_PARAMS } from '@/model/params'
import { LIP_LABELS, type LipType } from '@/geometry/lip'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'
import { ParamSlider } from './ParamSlider'

const SIZE = 32

/** Wall cross-section near the rim, seen from the side (vase body on the left). */
const ICONS: Record<LipType, string> = {
  none: 'M10,28V6',
  flared: 'M10,28V16Q10,9 20,5',
  rolled: 'M10,28V16L15,11A5,5 0 0 0 10,6',
}

const OPTIONS: IconOption<LipType>[] = ENUM_PARAMS.lipType.map((l) => ({
  value: l,
  label: LIP_LABELS[l],
  path: ICONS[l],
}))

export function LipControls() {
  const lipType = useVaseStore((s) => s.params.lipType)
  const setParam = useVaseStore((s) => s.setParam)

  return (
    <div className="space-y-4">
      <IconToggleGroup
        value={lipType}
        options={OPTIONS}
        onChange={(v) => setParam('lipType', v)}
        viewBox={{ w: SIZE, h: SIZE }}
        ariaLabel="Lip"
        variant="stroke"
      />
      {lipType === 'flared' && (
        <>
          <ParamSlider param="lipHeight" />
          <ParamSlider param="lipFlareAngle" />
        </>
      )}
      {lipType === 'rolled' && <ParamSlider param="lipRollRadius" />}
    </div>
  )
}
