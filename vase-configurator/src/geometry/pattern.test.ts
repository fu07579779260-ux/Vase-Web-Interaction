import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { maxRadius } from './bounds'
import { PREVIEW_DETAIL, patternFunction } from './pattern'
import { generateVaseMesh, meshResolution, type MeshData } from './vase-mesh'

const params = (over: Partial<VaseParams>): VaseParams => ({
  ...DEFAULT_PARAMS,
  patternAmplitude: 3,
  patternCountAround: 8,
  patternCountVertical: 3,
  spiralTurns: 1,
  patternFadeBottom: 0,
  ...over,
})
const TAU = Math.PI * 2
const TYPES = ['waves', 'ribs', 'spiral'] as const

describe('patternFunction', () => {
  it('returns null for no pattern or zero amplitude', () => {
    expect(patternFunction(params({ patternType: 'none' }))).toBeNull()
    expect(patternFunction(params({ patternType: 'ribs', patternAmplitude: 0 }))).toBeNull()
  })

  it.each(TYPES)('%s stays within [0, amplitude] and reaches both ends', (type) => {
    const d = patternFunction(params({ patternType: type }))!
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i <= 200; i++) {
      for (let k = 0; k <= 40; k++) {
        const v = d((i / 200) * TAU, k / 40)
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
    expect(lo).toBeGreaterThanOrEqual(-1e-12)
    expect(hi).toBeLessThanOrEqual(3 + 1e-12)
    expect(lo).toBeLessThan(0.05)
    expect(hi).toBeGreaterThan(2.95)
  })

  it('ribs peak on the rib and vanish between ribs', () => {
    const d = patternFunction(params({ patternType: 'ribs' }))!
    expect(d(0, 0.5)).toBeCloseTo(3, 12)
    expect(d(Math.PI / 8, 0.5)).toBeCloseTo(0, 12)
  })

  it('waves with no vertical count are plain vertical flutes', () => {
    const d = patternFunction(params({ patternType: 'waves', patternCountVertical: 0 }))!
    expect(d(0.3, 0.1)).toBeCloseTo(d(0.3, 0.9), 12)
  })

  it('a spiral ridge winds the set number of turns', () => {
    const d = patternFunction(params({ patternType: 'spiral', spiralTurns: 1.5 }))!
    for (const t of [0, 0.25, 0.5, 1]) expect(d(TAU * 1.5 * t, t)).toBeCloseTo(3, 10)
  })

  it('fades in from zero at the base', () => {
    const d = patternFunction(params({ patternType: 'ribs', patternFadeBottom: 15, height: 150 }))!
    expect(d(0, 0)).toBe(0)
    expect(d(0, 0.05)).toBeGreaterThan(0) // 7.5 mm: halfway through the fade
    expect(d(0, 0.05)).toBeLessThan(3)
    expect(d(0, 0.1)).toBeCloseTo(3, 12) // 15 mm: full height
  })
})

describe('pattern resolution', () => {
  it('raises radial segments to 8 per rib for export', () => {
    const r = meshResolution(params({ patternType: 'ribs', patternCountAround: 32 }), {
      segmentsVertical: 50,
      segmentsRadial: 60,
    })
    expect(r.segmentsRadial).toBe(256)
  })

  it('uses 4 per rib in the preview', () => {
    const r = meshResolution(
      params({ patternType: 'ribs', patternCountAround: 32 }),
      { segmentsVertical: 50, segmentsRadial: 60 },
      PREVIEW_DETAIL,
    )
    expect(r.segmentsRadial).toBe(128)
  })

  it('raises vertical segments for spirals and caps them', () => {
    const p = params({ patternType: 'spiral', patternCountAround: 64, spiralTurns: 5 })
    const r = meshResolution(p, { segmentsVertical: 50, segmentsRadial: 60 })
    expect(r.segmentsVertical).toBe(1024)
  })

  it('leaves resolution alone without a pattern', () => {
    const r = meshResolution(params({ patternType: 'none' }), { segmentsVertical: 50, segmentsRadial: 60 })
    expect(r).toEqual({ segmentsVertical: 50, segmentsRadial: 60 })
  })
})

// ---- Mesh-level checks ----

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

function isClosed({ indices }: MeshData): boolean {
  const directed = new Set<string>()
  for (let f = 0; f < indices.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const key = `${indices[f + e]}>${indices[f + ((e + 1) % 3)]}`
      if (directed.has(key)) return false
      directed.add(key)
    }
  }
  for (const key of directed) {
    const [a, b] = key.split('>')
    if (!directed.has(`${b}>${a}`)) return false
  }
  return true
}

const RES = { segmentsVertical: 40, segmentsRadial: 60 }

describe('mesh with patterns', () => {
  const plain = signedVolume(generateVaseMesh(params({ patternType: 'none' }), RES))

  it.each(TYPES)('%s: watertight, adds volume, stays inside the bounds radius', (type) => {
    const p = params({ patternType: type, sectionShape: 'star', sides: 5, twist: 60 })
    const mesh = generateVaseMesh(p, RES)
    expect(isClosed(mesh)).toBe(true)
    expect(signedVolume(mesh)).toBeGreaterThan(0)
    const limit = maxRadius(p)
    for (let i = 0; i < mesh.positions.length; i += 3) {
      expect(Math.hypot(mesh.positions[i], mesh.positions[i + 2])).toBeLessThanOrEqual(limit + 0.05)
    }
  })

  it.each(TYPES)('%s on a round vase adds volume', (type) => {
    expect(signedVolume(generateVaseMesh(params({ patternType: type }), RES))).toBeGreaterThan(plain)
  })
})
