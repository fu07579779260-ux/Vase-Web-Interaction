import { lipZone } from '@/geometry/lip'
import { offsetRing } from '@/geometry/offset'
import { EXPORT_DETAIL } from '@/geometry/pattern'
import { exportResolution, meshLayout, ringBuilder } from '@/geometry/vase-mesh'
import type { VaseParams } from '@/model/params'
import { periodicInterpolation, type Point } from './curves'

/**
 * NURBS surfaces for the Rhino "Surface" layer, as plain data (Z-up, mm).
 *
 * The surface passes exactly through a grid of points sampled from the vase:
 * - around (U): periodic, so there is no seam. Cubic through the samples for
 *   smooth sections; degree 1 (flat facets, sharp corners) for polygon and star.
 * - up (V): cubic through evenly spaced rings, with natural ends (no bending
 *   at the base and rim edges). Even spacing keeps the curve from rippling.
 *
 * Both directions use uniform knots k_j = j − (degree − 1), so the surface
 * domain is [0, rings−1] in V and [0, samples] in U, and at whole-number
 * parameters it hits the samples exactly. The open ends are planar, so
 * Rhino's Cap command turns the outer surface into a closed solid.
 */

export interface SurfaceData {
  name: string
  degreeU: number
  degreeV: number
  countU: number
  countV: number
  knotsU: number[]
  knotsV: number[]
  /** Control points, index (u · countV + v) · 3 */
  points: Float64Array
}

// The lip zone needs at least this many rings to keep its bend
const LIP_RINGS = 16
const MAX_RINGS = 1024

const zUp = (x: number, y: number, z: number): Point => [x, -z, y]

/** Uniform knots for `count` control points of the given degree (OpenNURBS: order + count − 2 knots). */
const uniformKnots = (degree: number, count: number) =>
  Array.from({ length: degree + 1 + count - 2 }, (_, j) => j - (degree - 1))

/**
 * Control values for a uniform cubic through values Q[0..m] at parameters 0..m,
 * with natural ends. Returns m + 3 values: [2P0 − P1, P0, …, Pm, 2Pm − Pm−1].
 * At parameter i the curve equals (P[i−1] + 4·P[i] + P[i+1]) / 6 = Q[i].
 */
export function naturalInterpolation(Q: number[]): number[] {
  const m = Q.length - 1
  const P = new Array<number>(m + 1)
  P[0] = Q[0]
  P[m] = Q[m]
  if (m >= 2) {
    // Thomas algorithm for P[i−1] + 4P[i] + P[i+1] = 6Q[i], i = 1..m−1
    const n = m - 1
    const c = new Array<number>(n)
    const d = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      let rhs = 6 * Q[i + 1]
      if (i === 0) rhs -= P[0]
      if (i === n - 1) rhs -= P[m]
      const denom = 4 - (i > 0 ? c[i - 1] : 0)
      c[i] = 1 / denom
      d[i] = (rhs - (i > 0 ? d[i - 1] : 0)) / denom
    }
    for (let i = n - 1; i >= 0; i--) P[i + 1] = d[i] - (i < n - 1 ? c[i] * P[i + 2] : 0)
  }
  return [2 * P[0] - (P[1] ?? P[0]), ...P, 2 * P[m] - (P[m - 1] ?? P[m])]
}

/** Rings sampled evenly from base to rim; enough for the pattern resolution and the lip. */
function ringCount(params: VaseParams): number {
  const { rowT } = meshLayout(params, exportResolution(params), EXPORT_DETAIL)
  const zone = lipZone(params) / params.height
  const forLip = zone > 0 ? Math.ceil(LIP_RINGS / zone) : 0
  return Math.min(MAX_RINGS, Math.max(rowT.length - 1, forLip))
}

/** Fit a surface through grid[ring][sample] (rings bottom to top, samples around). */
function fitSurface(name: string, grid: Point[][], sharp: boolean): SurfaceData {
  // Around: control points per ring
  const aroundCvs: Point[][] = grid.map((ring) => {
    if (sharp) return [...ring, ring[0]] // degree 1, closed
    const P = periodicInterpolation(ring)
    const n = P.length
    return [P[n - 1], ...P, P[0], P[1]] // degree 3, periodic wrap
  })
  const degreeU = sharp ? 1 : 3
  const countU = aroundCvs[0].length

  // Up: interpolate each around-CV column through the rings
  const countV = grid.length + 2
  const points = new Float64Array(countU * countV * 3)
  for (let u = 0; u < countU; u++) {
    for (let k = 0; k < 3; k++) {
      const column = naturalInterpolation(aroundCvs.map((row) => row[u][k]))
      for (let v = 0; v < countV; v++) points[(u * countV + v) * 3 + k] = column[v]
    }
  }

  return {
    name,
    degreeU,
    degreeV: 3,
    countU,
    countV,
    knotsU: uniformKnots(degreeU, countU),
    knotsV: uniformKnots(3, countV),
    points,
  }
}

export function vaseSurfaces(params: VaseParams): SurfaceData[] {
  const H = params.height
  const { cols } = meshLayout(params, exportResolution(params), EXPORT_DETAIL)
  const ringAt = ringBuilder(params, cols)
  const sharp = params.sectionShape === 'polygon' || params.sectionShape === 'star'
  const m = ringCount(params)

  const ring = (xs: ArrayLike<number>, zs: ArrayLike<number>, y: number) =>
    Array.from(xs, (x, j) => zUp(x, y, zs[j]))

  const outer = Array.from({ length: m + 1 }, (_, i) => {
    const t = i / m
    const r = ringAt(t)
    return ring(r.xs, r.zs, t * H)
  })
  const surfaces = [fitSurface('Outer wall', outer, sharp)]

  if (params.printMode === 'solidWall') {
    const floorY = Math.min(params.bottomThickness, H / 2)
    const inner = Array.from({ length: m + 1 }, (_, i) => {
      const y = floorY + ((H - floorY) * i) / m
      const r = ringAt(y / H)
      const off = offsetRing(r.xs, r.zs, params.wallThickness)
      return ring(off.xs, off.zs, y)
    })
    surfaces.push(fitSurface('Inner wall', inner, sharp))
  }
  return surfaces
}
