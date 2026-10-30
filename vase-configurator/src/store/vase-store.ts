import { create } from 'zustand'
import { fitsPrinter, vaseSize } from '@/geometry/bounds'
import { lerpPoints } from '@/geometry/profile-edit'
import { DEFAULT_MATERIAL, MATERIALS, materialPatch, type Material } from '@/model/materials'
import { PRINTERS, PRINTER_KEYS, printerPatch, type PrinterPreset } from '@/model/printers'
import {
  ZONE_KEYS,
  normalizeControlPoints,
  presetControlPoints,
  setZone,
  zoneValues,
  PRESET_SHAPES,
  type ProfilePreset,
  type ZoneKey,
} from '@/geometry/profile'
import {
  DEFAULT_PARAMS,
  NUMBER_PARAMS,
  QUALITY_PRESETS,
  clampParam,
  matchingQualityPreset,
  isNumberParam,
  vaseParamsSchema,
  type ControlPoint,
  type VaseParams,
} from '@/model/params'

interface VaseStore {
  params: VaseParams
  /** Set one parameter; numbers are clamped to their range. */
  setParam: <K extends keyof VaseParams>(key: K, value: VaseParams[K]) => void
  /** Merge several parameters at once; numbers are clamped. */
  setParams: (partial: Partial<VaseParams>) => void
  /** Load a profile preset: its control points plus its top/bottom radius ratio. */
  applyProfilePreset: (preset: ProfilePreset) => void
  /** Switch printer; the vase shrinks if it no longer fits, and the material follows the printer type. */
  applyPrinterPreset: (preset: PrinterPreset) => void
  /** Switch material and reset the colour to its default. */
  applyMaterial: (material: Material) => void
  /** Replace all parameters from untrusted data (JSON / URL). Returns false if invalid. */
  loadParams: (data: unknown) => boolean
  reset: () => void
}

const isZoneKey = (key: string): key is ZoneKey => (ZONE_KEYS as string[]).includes(key)

/**
 * Quality preset and segment counts stay consistent: picking a preset loads
 * its counts; moving a segment slider selects whichever preset matches, else "custom".
 */
function syncQuality(next: VaseParams, partial: Partial<VaseParams>): VaseParams {
  const preset = partial.qualityPreset
  if (preset && preset !== 'custom') return { ...next, ...QUALITY_PRESETS[preset] }
  if (preset === 'custom' || !('segmentsVertical' in partial || 'segmentsRadial' in partial)) return next
  return { ...next, qualityPreset: matchingQualityPreset(next) }
}

/**
 * Apply a patch: clamp numbers, normalise control points, route zone sliders
 * onto the belly/neck points, then re-read the zone values from the points so
 * sliders and curve always agree.
 */
function applyPatch(current: VaseParams, partial: Partial<VaseParams>): VaseParams {
  const next: Record<string, unknown> = { ...current }
  let points = partial.controlPoints ? normalizeControlPoints(partial.controlPoints) : current.controlPoints

  for (const [key, value] of Object.entries(partial)) {
    if (key === 'controlPoints') continue
    if (isZoneKey(key) && typeof value === 'number') {
      points = setZone(points, key, value)
    } else if (isNumberParam(key) && typeof value === 'number') {
      next[key] = clampParam(key, value)
    } else {
      next[key] = value
    }
  }

  return syncQuality({ ...(next as VaseParams), controlPoints: points, ...zoneValues(points) }, partial)
}

// ---- Build-volume limit (hard) ----

/** Shrink height and radii just enough to fit the printer, keeping the shape's proportions. */
export function scaleToFit(params: VaseParams): VaseParams {
  let next = applyPatch(params, { height: Math.min(params.height, params.buildZ) })
  const bed = Math.min(next.buildX, next.buildY)
  // Radii scale the profile exactly, but a pattern adds a fixed amplitude, so repeat until it fits
  for (let i = 0; i < 8 && !fitsPrinter(next); i++) {
    const f = (bed / vaseSize(next).diameter) * 0.999
    next = applyPatch(next, { bottomRadius: next.bottomRadius * f, topRadius: next.topRadius * f })
  }
  return next
}

/** Largest value between the current (fitting) one and the requested one that still fits. */
function searchFit(prev: VaseParams, key: string, target: number): VaseParams {
  const from = (prev as Record<string, unknown>)[key] as number
  let lo = 0 // fraction of the way from `from` to `target` known to fit
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (fitsPrinter(applyPatch(prev, { [key]: from + (target - from) * mid }))) lo = mid
    else hi = mid
  }
  const raw = from + (target - from) * lo
  // Prefer a clean slider value (256 rather than 255.9999996) when that still fits
  if (isNumberParam(key)) {
    const step = NUMBER_PARAMS[key].step
    const snapped = applyPatch(prev, { [key]: Math.round(raw / step) * step })
    if (fitsPrinter(snapped)) return snapped
  }
  return applyPatch(prev, { [key]: raw })
}

/** A dragged profile point stops where the vase touches the printer limit. */
function searchFitPoints(prev: VaseParams, target: ControlPoint[]): VaseParams {
  // Adding or removing a point can't be blended; refuse it rather than shrinking the vase
  if (target.length !== prev.controlPoints.length) return prev
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (fitsPrinter(applyPatch(prev, { controlPoints: lerpPoints(prev.controlPoints, target, mid) }))) lo = mid
    else hi = mid
  }
  return applyPatch(prev, { controlPoints: lerpPoints(prev.controlPoints, target, lo) })
}

const isPrinterKey = (key: string) => (PRINTER_KEYS as readonly string[]).includes(key)

/**
 * Apply a patch while honouring the printer. A single vase slider (or a dragged
 * profile point) stops at the limit; printer changes, presets and loads
 * shrink the vase to fit instead.
 */
function commit(prev: VaseParams, partial: Partial<VaseParams>): VaseParams {
  const next = applyPatch(prev, partial)
  if (fitsPrinter(next)) return next

  const entries = Object.entries(partial)
  const single = entries.length === 1 ? entries[0] : undefined
  if (single && fitsPrinter(prev)) {
    const [key, value] = single
    if (typeof value === 'number' && !isPrinterKey(key)) return searchFit(prev, key, value)
    if (key === 'controlPoints') return searchFitPoints(prev, normalizeControlPoints(value as ControlPoint[]))
  }
  return scaleToFit(next)
}

export const useVaseStore = create<VaseStore>()((set) => ({
  params: DEFAULT_PARAMS,

  setParam: (key, value) => set((state) => ({ params: commit(state.params, { [key]: value }) })),

  setParams: (partial) => set((state) => ({ params: commit(state.params, partial) })),

  applyProfilePreset: (preset) =>
    set((state) => ({
      params: commit(state.params, {
        profilePreset: preset,
        controlPoints: presetControlPoints(preset),
        topRadius: state.params.bottomRadius * PRESET_SHAPES[preset].topRatio,
      }),
    })),

  applyPrinterPreset: (preset) =>
    set((state) => {
      // A material the new printer can't use switches to that printer type's default
      const kind = PRINTERS[preset].kind
      const material = MATERIALS[state.params.material].kind === kind ? {} : materialPatch(DEFAULT_MATERIAL[kind])
      return { params: commit(state.params, { ...printerPatch(preset), ...material }) }
    }),

  applyMaterial: (material) => set((state) => ({ params: commit(state.params, materialPatch(material)) })),

  loadParams: (data) => {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
    // Missing fields fall back to defaults so older saves keep loading
    const result = vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...data })
    if (!result.success) return false
    // Points win over stored zone values; zone values are re-derived from them
    set({ params: scaleToFit(applyPatch(result.data, { controlPoints: result.data.controlPoints })) })
    return true
  },

  reset: () => set({ params: DEFAULT_PARAMS }),
}))
