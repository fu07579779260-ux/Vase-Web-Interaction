import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { generateVaseMesh, stlBytes } from '@/geometry/vase-mesh'
import { buildExportMesh, sanitizeFileName } from './export'
import { meshToStl } from './stl'

const RES = { segmentsVertical: 20, segmentsRadial: 32 }
const params = (over: Partial<VaseParams> = {}): VaseParams => ({ ...DEFAULT_PARAMS, ...over })

/** Read a binary STL back into triangles. */
function parseStl(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const count = view.getUint32(80, true)
  const tris: { n: number[]; v: number[][] }[] = []
  let o = 84
  for (let f = 0; f < count; f++) {
    const read = () => {
      const x = view.getFloat32(o, true)
      o += 4
      return x
    }
    const n = [read(), read(), read()]
    const v = [0, 1, 2].map(() => [read(), read(), read()])
    o += 2
    tris.push({ n, v })
  }
  return { count, tris }
}

function volume(tris: { v: number[][] }[]) {
  let vol = 0
  for (const { v } of tris) {
    const [a, b, c] = v
    vol +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])
  }
  return vol / 6
}

describe('meshToStl', () => {
  const mesh = generateVaseMesh(params(), RES)
  const buffer = meshToStl(mesh)
  const { count, tris } = parseStl(buffer)

  it('has the binary STL layout: 80-byte header, count, 50 bytes per triangle', () => {
    expect(count).toBe(mesh.indices.length / 3)
    expect(buffer.byteLength).toBe(stlBytes(count))
  })

  it('header does not start with "solid" (that would mark ASCII STL)', () => {
    const head = new TextDecoder().decode(new Uint8Array(buffer, 0, 5))
    expect(head.toLowerCase()).not.toBe('solid')
    const sneaky = new TextDecoder().decode(new Uint8Array(meshToStl(mesh, 'solid trouble'), 0, 5))
    expect(sneaky).not.toBe('solid')
  })

  it('is Z-up in mm: base on z = 0, top at the vase height', () => {
    const zs = tris.flatMap((t) => t.v.map((p) => p[2]))
    expect(Math.min(...zs)).toBe(0)
    expect(Math.max(...zs)).toBeCloseTo(DEFAULT_PARAMS.height, 4)
  })

  it('keeps the winding: volume is positive and matches the source mesh', () => {
    const P = mesh.positions
    const I = mesh.indices
    const source = Array.from({ length: I.length / 3 }, (_, f) => ({
      v: [0, 1, 2].map((k) => [P[I[3 * f + k] * 3], P[I[3 * f + k] * 3 + 1], P[I[3 * f + k] * 3 + 2]]),
    }))
    expect(volume(tris)).toBeGreaterThan(0)
    expect(volume(tris)).toBeCloseTo(volume(source), 0)
  })

  it('writes unit normals that agree with the winding', () => {
    for (const { n, v } of tris.slice(0, 200)) {
      expect(Math.hypot(...n)).toBeCloseTo(1, 5)
      const [a, b, c] = v
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      expect(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]).toBeGreaterThan(0)
    }
  })

  it('the base faces point down (−Z) after the rotation', () => {
    const base = tris.filter((t) => t.v.every((p) => p[2] === 0))
    expect(base.length).toBeGreaterThan(0)
    for (const t of base) expect(t.n[2]).toBeCloseTo(-1, 5)
  })
})

describe('buildExportMesh', () => {
  it('uses the export quality, not the preview one', () => {
    const p = params({ segmentsVertical: 64, segmentsRadial: 64, qualityPreset: 'draft' })
    expect(buildExportMesh(p).indices.length / 3).toBe(2 * 64 * 64 + 2 * 64)
  })
})

describe('sanitizeFileName', () => {
  it.each([
    ['vase', 'vase'],
    ['  my vase  ', 'my vase'],
    ['spiral.stl', 'spiral'],
    ['a/b\\c:d*e?', 'a-b-c-d-e'],
    ['花瓶 01', '花瓶 01'],
    ['', 'vase'],
    ['...', 'vase'],
  ])('%j → %j', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected)
  })
})
