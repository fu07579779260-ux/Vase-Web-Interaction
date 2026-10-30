import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { PROFILE_PRESETS, presetControlPoints } from './profile'
import { generateVaseMesh, previewResolution, type MeshData } from './vase-mesh'

const RES = { segmentsVertical: 10, segmentsRadial: 24 }

/** Every directed edge must appear once, and its reverse once: closed and consistently wound. */
function edgeProblems(mesh: MeshData): string[] {
  const directed = new Map<string, number>()
  const { indices } = mesh
  for (let f = 0; f < indices.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const key = `${indices[f + e]}>${indices[f + ((e + 1) % 3)]}`
      directed.set(key, (directed.get(key) ?? 0) + 1)
    }
  }
  const problems: string[] = []
  for (const [key, count] of directed) {
    const [a, b] = key.split('>')
    if (count !== 1) problems.push(`edge ${key} used ${count}×`)
    if (directed.get(`${b}>${a}`) !== 1) problems.push(`edge ${key} has no partner`)
  }
  return problems
}

/** Signed volume via the divergence theorem; positive when normals point outward. */
function signedVolume({ positions: P, indices: I }: MeshData): number {
  let vol = 0
  for (let f = 0; f < I.length; f += 3) {
    const a = I[f] * 3
    const b = I[f + 1] * 3
    const c = I[f + 2] * 3
    vol +=
      P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
      P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
      P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])
  }
  return vol / 6
}

/** Exact volume of a frustum whose cross-section is a regular n-gon inscribed in the radius. */
function polygonFrustumVolume(h: number, r1: number, r2: number, n: number) {
  const area = (r: number) => (n / 2) * r * r * Math.sin((2 * Math.PI) / n)
  const a1 = area(r1)
  const a2 = area(r2)
  return (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2))
}

const params = (over: Partial<VaseParams> = {}): VaseParams => ({ ...DEFAULT_PARAMS, ...over })

describe('generateVaseMesh', () => {
  it('has the expected vertex and triangle counts', () => {
    const mesh = generateVaseMesh(params(), RES)
    expect(mesh.positions.length / 3).toBe((10 + 1) * 24 + 2)
    expect(mesh.indices.length / 3).toBe(2 * 10 * 24 + 2 * 24)
  })

  it.each(PROFILE_PRESETS)('is watertight with consistent winding (%s)', (preset) => {
    const mesh = generateVaseMesh(params({ controlPoints: presetControlPoints(preset) }), RES)
    expect(edgeProblems(mesh)).toEqual([])
    expect(signedVolume(mesh)).toBeGreaterThan(0)
  })

  it('satisfies Euler V − E + F = 2 (closed, genus 0)', () => {
    const mesh = generateVaseMesh(params(), RES)
    const V = mesh.positions.length / 3
    const F = mesh.indices.length / 3
    const E = (F * 3) / 2
    expect(V - E + F).toBe(2)
  })

  it('points normals outward and encloses the right volume', () => {
    const p = params({
      height: 120,
      bottomRadius: 50,
      topRadius: 30,
      controlPoints: presetControlPoints('cylinder'), // straight side → exact frustum
    })
    const vol = signedVolume(generateVaseMesh(p, RES))
    const expected = polygonFrustumVolume(120, 50, 30, RES.segmentsRadial)
    expect(vol).toBeGreaterThan(0)
    expect(Math.abs(vol - expected) / expected).toBeLessThan(1e-4)
  })

  it('sits on the bed and spans the full height', () => {
    const { positions } = generateVaseMesh(params({ height: 180 }), RES)
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 1; i < positions.length; i += 3) {
      minY = Math.min(minY, positions[i])
      maxY = Math.max(maxY, positions[i])
    }
    expect(minY).toBe(0)
    expect(maxY).toBe(180)
  })

  it('contains no NaN coordinates', () => {
    const { positions } = generateVaseMesh(params(), RES)
    expect(positions.every(Number.isFinite)).toBe(true)
  })
})

describe('previewResolution', () => {
  it('halves export counts with a floor of 32', () => {
    expect(previewResolution(params({ segmentsVertical: 200, segmentsRadial: 180 }))).toEqual({
      segmentsVertical: 100,
      segmentsRadial: 90,
    })
    expect(previewResolution(params({ segmentsVertical: 16, segmentsRadial: 16 }))).toEqual({
      segmentsVertical: 32,
      segmentsRadial: 32,
    })
  })

  it('uses export counts when previewAtExportQuality is on', () => {
    const p = params({ previewAtExportQuality: true, segmentsVertical: 500, segmentsRadial: 400 })
    expect(previewResolution(p)).toEqual({ segmentsVertical: 500, segmentsRadial: 400 })
  })
})
