import { CONTROL_POINT_LIMITS, type ControlPoint } from '@/model/params'

/**
 * Edits made by the 2D profile editor. All of them return a new list (or null
 * when the edit isn't allowed) and keep the list valid: sorted by height, end
 * points pinned, neighbours never crossing.
 */

// Points keep at least this height fraction apart (matches the zone sliders)
export const MIN_GAP = 0.02

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const isInterior = (points: ControlPoint[], i: number) => i > 0 && i < points.length - 1

/** Move an interior point; it stays between its neighbours and within the radius limits. */
export function movePoint(points: ControlPoint[], index: number, t: number, r: number): ControlPoint[] | null {
  if (!isInterior(points, index)) return null
  const lo = points[index - 1].t + MIN_GAP
  const hi = points[index + 1].t - MIN_GAP
  const next = [...points]
  next[index] = {
    ...points[index],
    t: clamp(t, lo, hi),
    r: clamp(r, CONTROL_POINT_LIMITS.rMin, CONTROL_POINT_LIMITS.rMax),
  }
  return next
}

/** Insert a point at height t with multiplier r, if there is room and it isn't crowding a neighbour. */
export function addPoint(points: ControlPoint[], t: number, r: number): { points: ControlPoint[]; index: number } | null {
  if (points.length >= CONTROL_POINT_LIMITS.maxPoints) return null
  const index = points.findIndex((p) => p.t > t)
  if (index <= 0) return null // outside (0, 1)
  if (t - points[index - 1].t < MIN_GAP || points[index].t - t < MIN_GAP) return null
  const point = { t, r: clamp(r, CONTROL_POINT_LIMITS.rMin, CONTROL_POINT_LIMITS.rMax) }
  return { points: [...points.slice(0, index), point, ...points.slice(index)], index }
}

/** Remove an interior point, keeping the minimum count. Roles are reassigned by the store if needed. */
export function removePoint(points: ControlPoint[], index: number): ControlPoint[] | null {
  if (!isInterior(points, index) || points.length <= CONTROL_POINT_LIMITS.minPoints) return null
  return points.filter((_, i) => i !== index)
}

/** Blend between two lists of the same length (used to stop a drag at the printer limit). */
export function lerpPoints(a: ControlPoint[], b: ControlPoint[], f: number): ControlPoint[] {
  return a.map((p, i) => ({ ...b[i], t: p.t + (b[i].t - p.t) * f, r: p.r + (b[i].r - p.r) * f }))
}
