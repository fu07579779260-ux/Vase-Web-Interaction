import {
  PRESET_SHAPES,
  PROFILE_PRESETS,
  presetControlPoints,
  profileMultiplier,
  type ProfilePreset,
} from '@/geometry/profile'
import { useVaseStore } from '@/store/vase-store'
import { IconToggleGroup, type IconOption } from './IconToggleGroup'

const W = 32
const H = 40
const SAMPLES = 24

/** SVG path of a preset's silhouette, from the same curve the mesh uses. */
function silhouettePath(preset: ProfilePreset): string {
  const { topRatio } = PRESET_SHAPES[preset]
  const mult = profileMultiplier(presetControlPoints(preset))
  const radii = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES
    return (1 + (topRatio - 1) * t) * mult(t)
  })
  const scale = (W / 2 - 1) / Math.max(...radii)
  const right = radii.map((r, i) => `${(W / 2 + r * scale).toFixed(2)},${(H - (i / SAMPLES) * H).toFixed(2)}`)
  const left = radii.map((r, i) => `${(W / 2 - r * scale).toFixed(2)},${(H - (i / SAMPLES) * H).toFixed(2)}`).reverse()
  return `M${right.join('L')}L${left.join('L')}Z`
}

const OPTIONS: IconOption<ProfilePreset>[] = PROFILE_PRESETS.map((p) => ({
  value: p,
  label: PRESET_SHAPES[p].label,
  path: silhouettePath(p),
}))

export function ProfilePresetPicker() {
  const preset = useVaseStore((s) => s.params.profilePreset)
  const applyProfilePreset = useVaseStore((s) => s.applyProfilePreset)

  // Re-clicking the active preset re-applies it, acting as "reset to preset"
  return (
    <IconToggleGroup
      value={preset}
      options={OPTIONS}
      onChange={applyProfilePreset}
      viewBox={{ w: W, h: H }}
      ariaLabel="Profile preset"
    />
  )
}
