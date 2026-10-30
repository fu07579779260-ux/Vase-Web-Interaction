import type { VaseParams } from '@/model/params'
import { lipZone } from './lip'
import { radiusFunction } from './vase-mesh'

/**
 * Size of the vase for the build-volume check.
 *
 * The footprint is treated as a circle around the axis: sections never reach
 * past the profile radius, and twist can turn any corner in any direction, so
 * the vase must fit a circle whose diameter is the bed's shorter side.
 */

// The profile is smooth between control points, so this sampling finds the maximum to well under 0.1 mm
const SAMPLES = 400

export function maxRadius(params: VaseParams): number {
  const radiusAt = radiusFunction(params)
  let max = 0
  for (let i = 0; i <= SAMPLES; i++) max = Math.max(max, radiusAt(i / SAMPLES))
  // Exact peaks: control points, and the rolled bead's widest point (too narrow for even sampling)
  for (const { t } of params.controlPoints) max = Math.max(max, radiusAt(t))
  if (params.lipType === 'rolled') max = Math.max(max, radiusAt(1 - lipZone(params) / 2 / params.height))
  // Surface patterns push outward by up to their amplitude (build step 10)
  if (params.patternType !== 'none') max += params.patternAmplitude
  return max
}

export interface VaseSize {
  diameter: number
  height: number
}

export function vaseSize(params: VaseParams): VaseSize {
  return { diameter: 2 * maxRadius(params), height: params.height }
}

const EPS = 1e-6

export function fitsPrinter(params: VaseParams): boolean {
  const { diameter, height } = vaseSize(params)
  return diameter <= Math.min(params.buildX, params.buildY) + EPS && height <= params.buildZ + EPS
}
