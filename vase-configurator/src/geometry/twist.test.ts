import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, ENUM_PARAMS, type VaseParams } from '@/model/params'
import { presetControlPoints } from './profile'
import { EASINGS, twistFunction } from './twist'
import { generateVaseMesh, type MeshData } from './vase-mesh'

const params = (over: Partial<VaseParams>): VaseParams => ({ ...DEFAULT_PARAMS, ...over })
const DEG = Math.PI / 180

describe('easings', () => {
  it.each(ENUM_PARAMS.twistEasing)('%s starts at 0, ends at 1 and never goes backwards', (e) => {
    const f = EASINGS[e]
    expect(f(0)).toBe(0)
    expect(f(1)).toBe(1)
    for (let i = 1; i <= 100; i++) expect(f(i / 100)).toBeGreaterThanOrEqual(f((i - 1) / 100))
  })
})

describe('twistFunction', () => {
  it('reaches the full twist at the top', () => {
    expect(twistFunction({ twist: 90, twistEasing: 'linear' })(1)).toBeCloseTo(90 * DEG, 12)
    expect(twistFunction({ twist: -360, twistEasing: 'easeInOut' })(1)).toBeCloseTo(-360 * DEG, 12)
  })

  it('applies the easing in between', () => {
    expect(twistFunction({ twist: 100, twistEasing: 'easeIn' })(0.5)).toBeCloseTo(25 * DEG, 12)
    expect(twistFunction({ twist: 100, twistEasing: 'easeOut' })(0.5)).toBeCloseTo(75 * DEG, 12)
  })
})

// ---- Mesh-level checks ----

const RES = { segmentsVertical: 64, segmentsRadial: 60 }
const prism = (over: Partial<VaseParams>) =>
  params({
    height: 100,
    bottomRadius: 30,
    topRadius: 30,
    controlPoints: presetControlPoints('cylinder'),
    sectionShape: 'polygon',
    sides: 6,
    ...over,
  })

/** Angle of a ring's first vertex, counter-clockwise seen from above. */
function ringAngle({ positions }: MeshData, ring: number): number {
  const i = ring * RES.segmentsRadial * 3
  return Math.atan2(-positions[i + 2], positions[i])
}

function signedVolume({ positions: P, indices: I }: MeshData): number {
  let vol = 0
  for (let f = 0; f < I.length; f += 3) {
    const [a, b, c] = [I[f] * 3, I[f + 1] * 3, I[f + 2] * 3]
    vol +=
      P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
      P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
      P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])
  }
  return vol / 6
}

describe('twisted mesh', () => {
  it('leaves the bottom ring in place and turns the top ring by the twist', () => {
    const mesh = generateVaseMesh(prism({ twist: 45 }), RES)
    expect(ringAngle(mesh, 0)).toBeCloseTo(0, 5)
    expect(ringAngle(mesh, RES.segmentsVertical)).toBeCloseTo(45 * DEG, 5)
  })

  it('positive twist turns counter-clockwise seen from above', () => {
    const mesh = generateVaseMesh(prism({ twist: 30 }), RES)
    expect(ringAngle(mesh, RES.segmentsVertical)).toBeGreaterThan(0)
  })

  it('follows the easing halfway up', () => {
    const mesh = generateVaseMesh(prism({ twist: 80, twistEasing: 'easeIn' }), RES)
    expect(ringAngle(mesh, RES.segmentsVertical / 2)).toBeCloseTo(20 * DEG, 5)
  })

  it('does not change the radius or the volume (within triangulation error)', () => {
    const straight = signedVolume(generateVaseMesh(prism({ twist: 0 }), RES))
    const twisted = generateVaseMesh(prism({ twist: 180 }), RES)
    expect(Math.abs(signedVolume(twisted) - straight) / straight).toBeLessThan(0.01)
    const { positions } = twisted
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.hypot(positions[i], positions[i + 2])).toBeLessThanOrEqual(30 + 1e-4)
    }
  })
})
