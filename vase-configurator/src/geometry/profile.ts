import type { ControlPoint } from '@/model/params'

/**
 * Profile curve = the vase silhouette.
 *
 * Control points are (t, r): t is the height fraction (0 bottom → 1 top) and r
 * multiplies the straight taper between bottomRadius and topRadius. The first
 * and last points are pinned to t = 0 / t = 1 with r = 1, so the bottom/top
 * radius sliders always mean exactly what they say.
 *
 * Interpolation is monotone cubic (Fritsch–Carlson): smooth, passes through
 * every point, and never overshoots — bellies peak exactly at a control point
 * and the radius can't swing negative between points.
 */

export const PROFILE_PRESETS = ['cylinder', 'bulb', 'hourglass', 'cone', 'bottle'] as const
export type ProfilePreset = (typeof PROFILE_PRESETS)[number]

interface PresetShape {
  label: string
  /** topRadius / bottomRadius when the preset is applied */
  topRatio: number
  /** Silhouette as [t, radius / bottomRadius], first t = 0, last t = 1 */
  shape: [number, number][]
}

export const PRESET_SHAPES: Record<ProfilePreset, PresetShape> = {
  cylinder: { label: 'Cylinder', topRatio: 1, shape: [[0, 1], [0.33, 1], [0.67, 1], [1, 1]] },
  bulb: { label: 'Bulb', topRatio: 0.75, shape: [[0, 1], [0.35, 1.35], [0.8, 0.7], [1, 0.75]] },
  hourglass: {
    label: 'Hourglass',
    topRatio: 1,
    shape: [[0, 1], [0.25, 0.8], [0.5, 0.6], [0.75, 0.8], [1, 1]],
  },
  cone: { label: 'Cone', topRatio: 1.8, shape: [[0, 1], [0.33, 1.264], [0.67, 1.536], [1, 1.8]] },
  bottle: {
    label: 'Bottle',
    topRatio: 0.4,
    shape: [[0, 1], [0.45, 1.1], [0.7, 0.6], [0.85, 0.38], [1, 0.4]],
  },
}

/** Convert a preset's absolute silhouette into taper-relative control points. */
export function presetControlPoints(preset: ProfilePreset): ControlPoint[] {
  const { topRatio, shape } = PRESET_SHAPES[preset]
  return assignRoles(shape.map(([t, f]) => ({ t, r: f / (1 + (topRatio - 1) * t) })))
}

/** Sort by height, pin the end points and make sure belly/neck roles exist. */
export function normalizeControlPoints(points: ControlPoint[]): ControlPoint[] {
  const sorted = [...points].sort((a, b) => a.t - b.t)
  sorted[0] = { t: 0, r: 1 }
  sorted[sorted.length - 1] = { t: 1, r: 1 }
  return assignRoles(sorted)
}

// ---- Zone sliders ----
//
// Two interior points carry a role: the belly (widest) and the neck (narrowest
// above the belly). The four zone sliders move those points: position = t,
// width = r. Roles are stored on the points, so they never swap mid-drag.

export const ZONE_LIMITS = {
  bellyPosition: { min: 0.1, max: 0.7 },
  bellyWidth: { min: 0.8, max: 2 },
  neckPosition: { min: 0.5, max: 0.95 },
  neckWidth: { min: 0.3, max: 1.2 },
} as const

export type ZoneKey = keyof typeof ZONE_LIMITS
export const ZONE_KEYS = Object.keys(ZONE_LIMITS) as ZoneKey[]

// Points may not pass or touch their neighbours
const MIN_GAP = 0.02

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Keep valid existing roles; otherwise pick them: belly = widest interior point,
 * neck = narrowest interior point above it. Falls back to first/last interior point.
 * Expects points sorted by t with at least two interior points.
 */
export function assignRoles(points: ControlPoint[]): ControlPoint[] {
  const interior = points.slice(1, -1)
  const bellyIdx = interior.findIndex((p) => p.role === 'belly')
  const neckIdx = interior.findIndex((p) => p.role === 'neck')
  const rolesValid =
    bellyIdx !== -1 &&
    neckIdx > bellyIdx &&
    interior.filter((p) => p.role).length === 2

  if (rolesValid) return points

  let belly = 0
  interior.forEach((p, i) => {
    if (p.r > interior[belly].r) belly = i
  })
  let neck = -1
  for (let i = belly + 1; i < interior.length; i++) {
    if (neck === -1 || interior[i].r < interior[neck].r) neck = i
  }
  if (neck === -1) {
    belly = 0
    neck = interior.length - 1
  }

  return points.map((p, i) => {
    const { t, r } = p
    if (i === belly + 1) return { t, r, role: 'belly' as const }
    if (i === neck + 1) return { t, r, role: 'neck' as const }
    return { t, r }
  })
}

/** Current zone slider values, read from the role points (clamped to slider ranges). */
export function zoneValues(points: ControlPoint[]): Record<ZoneKey, number> {
  const belly = points.find((p) => p.role === 'belly')!
  const neck = points.find((p) => p.role === 'neck')!
  const lim = ZONE_LIMITS
  return {
    bellyPosition: clamp(belly.t, lim.bellyPosition.min, lim.bellyPosition.max),
    bellyWidth: clamp(belly.r, lim.bellyWidth.min, lim.bellyWidth.max),
    neckPosition: clamp(neck.t, lim.neckPosition.min, lim.neckPosition.max),
    neckWidth: clamp(neck.r, lim.neckWidth.min, lim.neckWidth.max),
  }
}

/** Move the belly or neck point. Positions can't pass neighbouring points. */
export function setZone(points: ControlPoint[], key: ZoneKey, value: number): ControlPoint[] {
  const role = key.startsWith('belly') ? 'belly' : 'neck'
  const i = points.findIndex((p) => p.role === role)
  const v = clamp(value, ZONE_LIMITS[key].min, ZONE_LIMITS[key].max)
  const next = [...points]

  if (key.endsWith('Position')) {
    const lo = points[i - 1].t + MIN_GAP
    const hi = points[i + 1].t - MIN_GAP
    next[i] = { ...points[i], t: clamp(v, lo, hi) }
  } else {
    next[i] = { ...points[i], r: v }
  }
  return next
}

/** Monotone cubic interpolation through (xs, ys); returns an evaluator. */
export function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const d: number[] = [] // secant slopes
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k] || 1e-9))

  const m: number[] = new Array(n) // tangents
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2

  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0
      m[k + 1] = 0
      continue
    }
    const a = m[k] / d[k]
    const b = m[k + 1] / d[k]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[k] = tau * a * d[k]
      m[k + 1] = tau * b * d[k]
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let k = 0
    while (k < n - 2 && x > xs[k + 1]) k++
    const h = xs[k + 1] - xs[k]
    const u = (x - xs[k]) / h
    const u2 = u * u
    const u3 = u2 * u
    return (
      (2 * u3 - 3 * u2 + 1) * ys[k] +
      (u3 - 2 * u2 + u) * h * m[k] +
      (-2 * u3 + 3 * u2) * ys[k + 1] +
      (u3 - u2) * h * m[k + 1]
    )
  }
}

/** Build r(t) for a set of control points. */
export function profileMultiplier(points: ControlPoint[]): (t: number) => number {
  const sorted = normalizeControlPoints(points)
  return monotoneCubic(
    sorted.map((p) => p.t),
    sorted.map((p) => p.r),
  )
}
