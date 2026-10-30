import type { VaseParams } from '@/model/params'
import { lipZone } from './lip'

/**
 * Surface patterns: an outward radial offset d(θ, t) in mm, always within
 * [0, amplitude]. Outward-only means a pattern can never pinch the wall
 * through the axis, and the outer size is simply radius + amplitude.
 *
 * θ is the section angle before twist, so patterns twist along with the vase.
 * Patterns fade in over `patternFadeBottom` and, when there is a lip, fade out
 * across the lip zone.
 */

export type PatternType = VaseParams['patternType']
type PatternParams = Pick<
  VaseParams,
  | 'patternType'
  | 'patternAmplitude'
  | 'patternCountAround'
  | 'patternCountVertical'
  | 'spiralTurns'
  | 'patternFadeBottom'
  | 'height'
  | 'lipType'
  | 'lipHeight'
  | 'lipFlareAngle'
  | 'lipRollRadius'
>

export const PATTERN_LABELS: Record<PatternType, string> = {
  none: 'None',
  waves: 'Waves',
  ribs: 'Ribs',
  spiral: 'Spiral',
}

// Rib profile sharpness: higher = narrower ridges with wider flat valleys
const RIB_POWER = 3

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** Build d(θ, t) in mm, or null when there is no pattern. */
export function patternFunction(p: PatternParams): ((theta: number, t: number) => number) | null {
  if (p.patternType === 'none' || p.patternAmplitude <= 0) return null
  const A = p.patternAmplitude
  const N = Math.round(p.patternCountAround)
  const V = Math.round(p.patternCountVertical)
  const fadeT = p.patternFadeBottom / p.height
  // With a lip, the pattern fades out across the lip zone so the rim stays clean
  const lipT = lipZone(p) / p.height
  const fade = (t: number) =>
    (fadeT > 0 ? smoothstep(t / fadeT) : 1) * (lipT > 0 ? smoothstep((1 - t) / lipT) : 1)

  switch (p.patternType) {
    case 'waves':
      // Bumps around × waves up the height; V = 0 gives smooth vertical flutes
      return (theta, t) => A * fade(t) * 0.5 * (1 + Math.cos(N * theta) * Math.cos(2 * Math.PI * V * t))
    case 'ribs':
      return (theta, t) => A * fade(t) * Math.pow(0.5 * (1 + Math.cos(N * theta)), RIB_POWER)
    case 'spiral':
      // Ridges wind `spiralTurns` full turns around the vase from bottom to top
      return (theta, t) =>
        A * fade(t) * 0.5 * (1 + Math.cos(N * (theta - 2 * Math.PI * p.spiralTurns * t)))
  }
}

export interface PatternDetail {
  /** Vertices per pattern period */
  samplesPerPeriod: number
  /** Upper limit for the raised segment counts */
  maxSegments: number
}

// Export keeps ridges round; the preview trades some smoothness for speed
export const EXPORT_DETAIL: PatternDetail = { samplesPerPeriod: 8, maxSegments: 1024 }
export const PREVIEW_DETAIL: PatternDetail = { samplesPerPeriod: 4, maxSegments: 512 }

/** Minimum mesh resolution a pattern needs to be resolved. */
export function patternMinResolution(
  p: PatternParams,
  detail: PatternDetail = EXPORT_DETAIL,
): { radial: number; vertical: number } {
  if (p.patternType === 'none') return { radial: 0, vertical: 0 }
  const { samplesPerPeriod: k, maxSegments } = detail
  const N = Math.round(p.patternCountAround)
  let vertical = 0
  if (p.patternType === 'waves') vertical = k * Math.round(p.patternCountVertical)
  // A spiral ridge crosses N × turns periods along any vertical line
  if (p.patternType === 'spiral') vertical = k * N * p.spiralTurns
  return {
    radial: Math.min(maxSegments, k * N),
    vertical: Math.min(maxSegments, Math.ceil(vertical)),
  }
}
