import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, ENUM_PARAMS, type VaseParams } from '@/model/params'
import { presetControlPoints } from './profile'
import { sectionFunction, snapRadialSegments } from './section'
import { generateVaseMesh, type MeshData } from './vase-mesh'

const sec = (over: Partial<VaseParams>) => ({ ...DEFAULT_PARAMS, ...over })
const TAU = Math.PI * 2

describe('sectionFunction', () => {
  it('circle is constant 1', () => {
    const s = sectionFunction(sec({ sectionShape: 'circle' }))
    for (let i = 0; i < 20; i++) expect(s((i / 20) * TAU)).toBe(1)
  })

  it.each([3, 4, 6, 9, 24])('polygon with %i sides: corners at 1, edges straight', (n) => {
    const s = sectionFunction(sec({ sectionShape: 'polygon', sides: n }))
    const sector = TAU / n
    expect(s(0)).toBeCloseTo(1, 12)
    expect(s(sector)).toBeCloseTo(1, 12)
    expect(s(sector / 2)).toBeCloseTo(Math.cos(Math.PI / n), 12)
    // Every point between two corners lies on the chord between them
    const [ax, ay] = [1, 0]
    const [bx, by] = [Math.cos(sector), Math.sin(sector)]
    for (let k = 1; k < 10; k++) {
      const th = (sector * k) / 10
      const [px, py] = [s(th) * Math.cos(th), s(th) * Math.sin(th)]
      const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
      expect(cross).toBeCloseTo(0, 12)
    }
  })

  it('star: tips at 1, valleys at 1 − depth', () => {
    const n = 5
    const s = sectionFunction(sec({ sectionShape: 'star', sides: n, starDepth: 0.4 }))
    expect(s(0)).toBeCloseTo(1, 12)
    expect(s(Math.PI / n)).toBeCloseTo(0.6, 12)
    expect(s(TAU / n)).toBeCloseTo(1, 12)
  })

  it('rounded polygon: 0 = sharp polygon, 1 = circle of the inradius', () => {
    const n = 6
    const sharp = sectionFunction(sec({ sectionShape: 'polygon', sides: n }))
    const r0 = sectionFunction(sec({ sectionShape: 'roundedPolygon', sides: n, cornerRounding: 0 }))
    const r1 = sectionFunction(sec({ sectionShape: 'roundedPolygon', sides: n, cornerRounding: 1 }))
    for (let i = 0; i < 60; i++) {
      const th = (i / 60) * TAU
      expect(r0(th)).toBeCloseTo(sharp(th), 10)
      expect(r1(th)).toBeCloseTo(Math.cos(Math.PI / n), 10)
    }
  })

  it('rounded polygon is continuous and stays between inradius and 1', () => {
    const n = 5
    const s = sectionFunction(sec({ sectionShape: 'roundedPolygon', sides: n, cornerRounding: 0.4 }))
    const inradius = Math.cos(Math.PI / n)
    let prev = s(0)
    for (let i = 1; i <= 2000; i++) {
      const v = s((i / 2000) * TAU)
      expect(v).toBeLessThanOrEqual(1 + 1e-12)
      expect(v).toBeGreaterThanOrEqual(inradius - 1e-12)
      expect(Math.abs(v - prev)).toBeLessThan(0.01) // no jumps at the fillet/edge joint
      prev = v
    }
  })
})

describe('snapRadialSegments', () => {
  it('leaves circles alone', () => {
    expect(snapRadialSegments(sec({ sectionShape: 'circle', sides: 7 }), 90)).toBe(90)
  })
  it('rounds polygons up to a multiple of the side count', () => {
    expect(snapRadialSegments(sec({ sectionShape: 'polygon', sides: 6 }), 90)).toBe(90)
    expect(snapRadialSegments(sec({ sectionShape: 'polygon', sides: 7 }), 90)).toBe(91)
    expect(snapRadialSegments(sec({ sectionShape: 'roundedPolygon', sides: 7 }), 90)).toBe(91)
  })
  it('rounds stars up to a multiple of twice the point count', () => {
    expect(snapRadialSegments(sec({ sectionShape: 'star', sides: 7 }), 90)).toBe(98)
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

const RES = { segmentsVertical: 8, segmentsRadial: 60 }
// Straight-sided prism of radius 30, height 100
const prism = (over: Partial<VaseParams>) =>
  sec({ height: 100, bottomRadius: 30, topRadius: 30, controlPoints: presetControlPoints('cylinder'), ...over })

describe('mesh with sections', () => {
  it.each(ENUM_PARAMS.sectionShape)('%s mesh is watertight with positive volume', (shape) => {
    const mesh = generateVaseMesh(sec({ sectionShape: shape, sides: 7 }), RES)
    expect(isClosed(mesh)).toBe(true)
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it('hexagonal prism has the exact hexagon volume', () => {
    const n = 6
    const area = (n / 2) * 30 * 30 * Math.sin(TAU / n)
    const vol = signedVolume(generateVaseMesh(prism({ sectionShape: 'polygon', sides: n }), RES))
    expect(Math.abs(vol - area * 100) / (area * 100)).toBeLessThan(1e-5)
  })

  it('star prism has the exact star volume', () => {
    const n = 5
    const inner = 30 * (1 - 0.3)
    const area = 2 * n * 0.5 * 30 * inner * Math.sin(Math.PI / n)
    const vol = signedVolume(generateVaseMesh(prism({ sectionShape: 'star', sides: n, starDepth: 0.3 }), RES))
    expect(Math.abs(vol - area * 100) / (area * 100)).toBeLessThan(1e-5)
  })

  it.each(ENUM_PARAMS.sectionShape)('%s never extends beyond the radius', (shape) => {
    const { positions } = generateVaseMesh(prism({ sectionShape: shape, sides: 5 }), RES)
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.hypot(positions[i], positions[i + 2])).toBeLessThanOrEqual(30 + 1e-4)
    }
  })
})
