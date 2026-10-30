import type { VaseParams } from '@/model/params'

/**
 * Lip / rim: an outward offset (mm) added to the profile radius near the top.
 * The lip lives inside the vase height, so the total height never changes.
 *
 * - flared: the wall bends outward, reaching `lipFlareAngle` from vertical at
 *   the rim. The slope ramps up from 0, so the bend is smooth.
 * - rolled: a bead at the rim. Its underside is a 45° ramp (printable without
 *   support), its top a quarter circle that rounds into the rim.
 */

export type LipType = VaseParams['lipType']
type LipParams = Pick<VaseParams, 'lipType' | 'lipHeight' | 'lipFlareAngle' | 'lipRollRadius' | 'height'>

export const LIP_LABELS: Record<LipType, string> = {
  none: 'None',
  flared: 'Flared',
  rolled: 'Rolled',
}

// A lip may take at most this share of the vase height
const MAX_ZONE_SHARE = 0.5

/** Height of the lip zone in mm, measured down from the rim. */
export function lipZone(p: LipParams): number {
  const zone = p.lipType === 'flared' ? p.lipHeight : p.lipType === 'rolled' ? 2 * p.lipRollRadius : 0
  return Math.min(zone, p.height * MAX_ZONE_SHARE)
}

/** Outward offset in mm at height y (mm), or null when there is no lip. */
export function lipOffsetFunction(p: LipParams): ((y: number) => number) | null {
  const zone = lipZone(p)
  if (zone <= 0) return null
  const start = p.height - zone

  if (p.lipType === 'flared') {
    const tan = Math.tan((p.lipFlareAngle * Math.PI) / 180)
    // offset = zone·tan·u²/2 → slope goes 0 → tan across the zone
    return (y) => {
      if (y <= start) return 0
      const u = (y - start) / zone
      return (zone * tan * u * u) / 2
    }
  }

  // Rolled: the zone may have been capped, so derive the bead radius from it
  const rho = zone / 2
  const centre = p.height - rho
  return (y) => {
    if (y <= start) return 0
    if (y <= centre) return y - start // 45° underside
    const s = y - centre
    return Math.sqrt(Math.max(0, rho * rho - s * s)) // quarter round on top
  }
}
