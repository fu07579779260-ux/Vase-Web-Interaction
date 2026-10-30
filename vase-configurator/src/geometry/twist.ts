import type { VaseParams } from '@/model/params'

/**
 * Twist: each ring is rotated about the vertical axis by twist × ease(t).
 * Positive angles turn counter-clockwise seen from above (right-hand rule about +Y).
 */

export type TwistEasing = VaseParams['twistEasing']

export const EASINGS: Record<TwistEasing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t * t * (3 - 2 * t),
}

export const EASING_LABELS: Record<TwistEasing, string> = {
  linear: 'Linear',
  easeIn: 'Ease in',
  easeOut: 'Ease out',
  easeInOut: 'In-out',
}

/** Rotation in radians at height fraction t. */
export function twistFunction(p: Pick<VaseParams, 'twist' | 'twistEasing'>): (t: number) => number {
  const ease = EASINGS[p.twistEasing]
  const total = (p.twist * Math.PI) / 180
  return (t) => total * ease(t)
}
