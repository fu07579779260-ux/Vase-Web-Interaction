import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, ENUM_PARAMS, type VaseParams } from '@/model/params'
import { MIN_INNER_RADIUS, offsetRing } from './offset'
import { PROFILE_PRESETS, presetControlPoints } from './profile'
import { sectionFunction } from './section'
import { generateVaseMesh, meshLayout, type MeshData } from './vase-mesh'

const TAU = Math.PI * 2

/** Outer ring of a section shape at radius R, n vertices. */
function ring(over: Partial<VaseParams>, R: number, n: number) {
  const s = sectionFunction({ ...DEFAULT_PARAMS, ...over })
  const xs = new Float64Array(n)
  const zs = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    const th = (j / n) * TAU
    xs[j] = R * s(th) * Math.cos(th)
    zs[j] = R * s(th) * Math.sin(th)
  }
  return { xs, zs }
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const ex = bx - ax
  const ez = bz - az
  const s = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez)))
  return Math.hypot(px - ax - s * ex, pz - az - s * ez)
}

/** Distance from each inner point to the nearest outer segment. */
function wallDistances(outer: { xs: Float64Array; zs: Float64Array }, inner: { xs: Float64Array; zs: Float64Array }) {
  const n = outer.xs.length
  return Array.from(inner.xs, (_, j) => {
    let d = Infinity
    for (let k = 0; k < n; k++) {
      const m = (k + 1) % n
      d = Math.min(d, distToSegment(inner.xs[j], inner.zs[j], outer.xs[k], outer.zs[k], outer.xs[m], outer.zs[m]))
    }
    return d
  })
}

describe('offsetRing', () => {
  it('hexagon: corners move in along the corner ray by w / cos 30° (mitred)', () => {
    const outer = ring({ sectionShape: 'polygon', sides: 6 }, 30, 60)
    const inner = offsetRing(outer.xs, outer.zs, 2)
    expect(Math.hypot(inner.xs[0], inner.zs[0])).toBeCloseTo(30 - 2 / Math.cos(Math.PI / 6), 9)
  })

  it.each([
    ['circle', { sectionShape: 'circle' }],
    ['hexagon', { sectionShape: 'polygon', sides: 6 }],
    ['star', { sectionShape: 'star', sides: 7, starDepth: 0.4 }],
    ['rounded', { sectionShape: 'roundedPolygon', sides: 5, cornerRounding: 0.5 }],
  ] as const)('%s: every inner point is exactly w from the outer wall', (_, over) => {
    const outer = ring(over, 30, 140)
    const inner = offsetRing(outer.xs, outer.zs, 2.5)
    for (const d of wallDistances(outer, inner)) {
      expect(d).toBeGreaterThanOrEqual(2.5 - 1e-9)
      expect(d).toBeLessThanOrEqual(2.5 + 1e-6)
    }
  })

  it('keeps each inner point on its outer vertex direction (so it can never fold)', () => {
    const outer = ring({ sectionShape: 'star', sides: 9, starDepth: 0.5 }, 25, 180)
    const inner = offsetRing(outer.xs, outer.zs, 4)
    for (let j = 0; j < 180; j++) {
      const cross = outer.xs[j] * inner.zs[j] - outer.zs[j] * inner.xs[j]
      expect(cross).toBeCloseTo(0, 9)
      expect(outer.xs[j] * inner.xs[j] + outer.zs[j] * inner.zs[j]).toBeGreaterThan(0)
    }
  })

  it('stops at a small core when the wall is thicker than the radius', () => {
    const outer = ring({ sectionShape: 'circle' }, 1.5, 32)
    const inner = offsetRing(outer.xs, outer.zs, 3)
    for (let j = 0; j < 32; j++) expect(Math.hypot(inner.xs[j], inner.zs[j])).toBeCloseTo(MIN_INNER_RADIUS, 12)
  })
})

// ---- Solid-wall meshes ----

function edgeProblems({ indices }: MeshData): number {
  const directed = new Map<string, number>()
  for (let f = 0; f < indices.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const key = `${indices[f + e]}>${indices[f + ((e + 1) % 3)]}`
      directed.set(key, (directed.get(key) ?? 0) + 1)
    }
  }
  let bad = 0
  for (const [key, count] of directed) {
    const [a, b] = key.split('>')
    if (count !== 1 || directed.get(`${b}>${a}`) !== 1) bad++
  }
  return bad
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

const RES = { segmentsVertical: 20, segmentsRadial: 60 }
const solid = (over: Partial<VaseParams>): VaseParams => ({
  ...DEFAULT_PARAMS,
  printMode: 'solidWall',
  wallThickness: 2,
  bottomThickness: 1.2,
  ...over,
})

describe('solid-wall mesh', () => {
  it('has the expected vertex and triangle counts', () => {
    const p = solid({})
    const { rowT, cols } = meshLayout(p, RES)
    const mesh = generateVaseMesh(p, RES)
    expect(mesh.positions.length / 3).toBe(2 * rowT.length * cols + 2)
    expect(mesh.indices.length / 3).toBe(4 * (rowT.length - 1) * cols + 4 * cols)
  })

  it.each(PROFILE_PRESETS)('%s profile: watertight, genus 0, positive volume', (preset) => {
    const mesh = generateVaseMesh(solid({ controlPoints: presetControlPoints(preset) }), RES)
    expect(edgeProblems(mesh)).toBe(0)
    const V = mesh.positions.length / 3
    const F = mesh.indices.length / 3
    expect(V - (3 * F) / 2 + F).toBe(2)
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it.each(ENUM_PARAMS.sectionShape)('%s section with twist, pattern and lip: watertight', (shape) => {
    const p = solid({ sectionShape: shape, sides: 6, twist: 90, patternType: 'ribs', lipType: 'rolled' })
    const mesh = generateVaseMesh(p, RES)
    expect(edgeProblems(mesh)).toBe(0)
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it('hollow hexagonal prism has the exact volume', () => {
    const n = 6
    const R = 30
    const w = 2
    const h = 100
    const b = 1.2
    const area = (r: number) => (n / 2) * r * r * Math.sin(TAU / n)
    const expected = area(R) * h - area(R - w / Math.cos(Math.PI / n)) * (h - b)
    const p = solid({
      height: h,
      bottomRadius: R,
      topRadius: R,
      controlPoints: presetControlPoints('cylinder'),
      sectionShape: 'polygon',
      sides: n,
      wallThickness: w,
      bottomThickness: b,
    })
    const vol = signedVolume(generateVaseMesh(p, RES))
    expect(Math.abs(vol - expected) / expected).toBeLessThan(1e-5)
  })

  it('floor sits at the bottom thickness and the rim at full height', () => {
    const mesh = generateVaseMesh(solid({ height: 120, bottomThickness: 3 }), RES)
    const ys = new Set<number>()
    for (let i = 1; i < mesh.positions.length; i += 3) ys.add(Math.round(mesh.positions[i] * 1000) / 1000)
    expect(ys.has(3)).toBe(true)
    expect(Math.max(...ys)).toBe(120)
    expect(Math.min(...ys)).toBe(0)
  })

  it('is much lighter than the vase-mode solid', () => {
    const full = signedVolume(generateVaseMesh({ ...solid({}), printMode: 'vaseMode' }, RES))
    const cup = signedVolume(generateVaseMesh(solid({}), RES))
    expect(cup).toBeLessThan(full * 0.3)
  })
})
