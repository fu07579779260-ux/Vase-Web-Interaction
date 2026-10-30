import type { VaseParams } from '@/model/params'

/**
 * Cross-sections as polar functions: s(θ) is the distance from the axis to the
 * outline at angle θ, for a shape whose corners touch the unit circle.
 * The mesh scales it by the profile radius, so "radius" always means the
 * outermost extent (corner / star tip) — which keeps build-volume checks simple.
 */

export type SectionShape = VaseParams['sectionShape']
type SectionParams = Pick<VaseParams, 'sectionShape' | 'sides' | 'starDepth' | 'cornerRounding'>

const TAU = Math.PI * 2

/** Polar distance to the straight segment from (a1, r1) to (a2, r2), at angle θ between them. */
function segmentRadius(theta: number, a1: number, r1: number, a2: number, r2: number): number {
  return (r1 * r2 * Math.sin(a2 - a1)) / (r1 * Math.sin(theta - a1) + r2 * Math.sin(a2 - theta))
}

/** Angle relative to the nearest corner, folded into [0, π/n] (all shapes are mirror-symmetric). */
function foldToSector(theta: number, n: number): number {
  const sector = TAU / n
  let phi = ((theta % sector) + sector) % sector // [0, sector)
  if (phi > sector / 2) phi = sector - phi
  return phi
}

/** Star / polygon: zig-zag between tips at radius 1 and valleys at `inner`. */
function zigzag(theta: number, n: number, inner: number): number {
  const half = Math.PI / n
  return segmentRadius(foldToSector(theta, n), 0, 1, half, inner)
}

/**
 * Regular polygon with filleted corners. The inradius stays fixed at cos(π/n),
 * so rounding 0 = sharp polygon (corners at 1) and rounding 1 = circle of the inradius.
 */
function roundedPolygon(theta: number, n: number, rounding: number): number {
  const half = Math.PI / n
  const inradius = Math.cos(half)
  const rho = rounding * inradius // fillet radius
  const c = (inradius - rho) / inradius // distance of the fillet centre from the axis
  const phi = foldToSector(theta, n)

  // Where the fillet meets the straight edge
  const tangentAngle = Math.atan2(rho * Math.sin(half), c + rho * Math.cos(half))
  if (phi >= tangentAngle) return inradius / Math.cos(half - phi)

  const uc = c * Math.cos(phi)
  return uc + Math.sqrt(uc * uc - c * c + rho * rho)
}

/** Build s(θ) for the current section settings. */
export function sectionFunction(p: SectionParams): (theta: number) => number {
  const n = Math.round(p.sides)
  switch (p.sectionShape) {
    case 'circle':
      return () => 1
    case 'polygon':
      return (theta) => zigzag(theta, n, Math.cos(Math.PI / n))
    case 'star':
      return (theta) => zigzag(theta, n, 1 - p.starDepth)
    case 'roundedPolygon':
      return (theta) => roundedPolygon(theta, n, p.cornerRounding)
  }
}

/**
 * Round the radial vertex count up so every corner (and star valley) lands
 * exactly on a vertex — otherwise sharp corners get shaved off.
 */
export function snapRadialSegments(p: SectionParams, requested: number): number {
  const n = Math.round(p.sides)
  const step = p.sectionShape === 'circle' ? 1 : p.sectionShape === 'star' ? 2 * n : n
  return Math.ceil(requested / step) * step
}

export const SECTION_LABELS: Record<SectionShape, string> = {
  circle: 'Circle',
  polygon: 'Polygon',
  star: 'Star',
  roundedPolygon: 'Rounded',
}
