import { lipZone } from '@/geometry/lip'
import { offsetRing } from '@/geometry/offset'
import { EXPORT_DETAIL } from '@/geometry/pattern'
import { exportResolution, meshLayout, radiusFunction, ringBuilder } from '@/geometry/vase-mesh'
import type { VaseParams } from '@/model/params'

/**
 * Construction curves for the Rhino "Curves" layer, as plain data (Z-up, mm):
 *
 * - Profile: the silhouette radius(t) in the XZ plane, as a cubic curve.
 * - Sections: closed outlines at evenly spaced heights (plus extra in the lip),
 *   with section shape, twist and pattern applied — loft them to rebuild the
 *   vase. Solid-wall vases also get the inner outlines.
 *
 * Smooth outlines are periodic cubics that pass exactly through the sampled
 * points; outlines with sharp corners (polygon, star) are polylines so the
 * corners stay sharp.
 */

export type Point = [number, number, number]

export interface CurveData {
  name: string
  /** periodicCubic: control points of a closed uniform cubic. openCubic: clamped cubic control points. polyline: closed point list. */
  kind: 'periodicCubic' | 'openCubic' | 'polyline'
  points: Point[]
}

// Evenly spaced sections from base to rim, plus extra ones in the lip zone
const SECTIONS = 16
const LIP_SECTIONS = 4
// Profile control points per mm of height; a dense cubic stays within ~0.01 mm of the true silhouette
const PROFILE_SAMPLES_PER_MM = 4
const PROFILE_MIN = 100
const PROFILE_MAX = 1200

/** Y-up scene point → Z-up file point. */
const zUp = (x: number, y: number, z: number): Point => [x, -z, y]

/**
 * Control points of the uniform periodic cubic B-spline through the points Q.
 * At its knots that curve equals (P[i−1] + 4·P[i] + P[i+1]) / 6, so solve that
 * cyclic system. It is strongly diagonally dominant: Gauss–Seidel halves the
 * error each sweep.
 */
export function periodicInterpolation(Q: Point[], sweeps = 60): Point[] {
  const n = Q.length
  const P = Q.map((q) => [...q] as Point)
  for (let s = 0; s < sweeps; s++) {
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n]
      const b = P[(i + 1) % n]
      for (let k = 0; k < 3; k++) P[i][k] = (6 * Q[i][k] - a[k] - b[k]) / 4
    }
  }
  return P
}

/** Evaluate the periodic cubic at its knots: (P[i−1] + 4·P[i] + P[i+1]) / 6. */
export function periodicKnotPoints(P: Point[]): Point[] {
  const n = P.length
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n]
    const b = P[(i + 1) % n]
    return [0, 1, 2].map((k) => (a[k] + 4 * p[k] + b[k]) / 6) as Point
  })
}

/** Does the section outline have sharp corners that a smooth curve would round off? */
const hasSharpCorners = (p: VaseParams) => p.sectionShape === 'polygon' || p.sectionShape === 'star'

function sectionHeights(params: VaseParams): number[] {
  const ts = Array.from({ length: SECTIONS + 1 }, (_, i) => i / SECTIONS)
  const zone = lipZone(params) / params.height
  if (zone > 0) for (let i = 1; i <= LIP_SECTIONS; i++) ts.push(1 - zone + (zone * i) / (LIP_SECTIONS + 1))
  return [...new Set(ts)].sort((a, b) => a - b)
}

function outline(name: string, xs: ArrayLike<number>, zs: ArrayLike<number>, y: number, sharp: boolean): CurveData {
  const points = Array.from(xs, (x, j) => zUp(x, y, zs[j]))
  return sharp
    ? { name, kind: 'polyline', points: [...points, points[0]] }
    : { name, kind: 'periodicCubic', points: periodicInterpolation(points) }
}

export function constructionCurves(params: VaseParams): CurveData[] {
  const H = params.height
  const { cols } = meshLayout(params, exportResolution(params), EXPORT_DETAIL)
  const ringAt = ringBuilder(params, cols)
  const sharp = hasSharpCorners(params)
  const curves: CurveData[] = []

  // Profile in the XZ plane (file coordinates), base to rim
  const radiusAt = radiusFunction(params)
  const n = Math.min(PROFILE_MAX, Math.max(PROFILE_MIN, Math.round(H * PROFILE_SAMPLES_PER_MM)))
  curves.push({
    name: 'Profile',
    kind: 'openCubic',
    points: Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n
      return [radiusAt(t), 0, t * H] as Point
    }),
  })

  for (const t of sectionHeights(params)) {
    const ring = ringAt(t)
    curves.push(outline(`Section ${(t * H).toFixed(1)} mm`, ring.xs, ring.zs, t * H, sharp))
  }

  if (params.printMode === 'solidWall') {
    const floorY = Math.min(params.bottomThickness, H / 2)
    for (const t of sectionHeights(params)) {
      const y = floorY + (H - floorY) * t
      const outer = ringAt(y / H)
      const inner = offsetRing(outer.xs, outer.zs, params.wallThickness)
      curves.push(outline(`Inner section ${y.toFixed(1)} mm`, inner.xs, inner.zs, y, sharp))
    }
  }

  return curves
}
