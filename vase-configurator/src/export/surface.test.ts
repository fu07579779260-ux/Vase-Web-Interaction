import rhino3dm, { type NurbsSurface, type RhinoModule } from 'rhino3dm'
import { beforeAll, describe, expect, it } from 'vitest'
import { EXPORT_DETAIL } from '@/geometry/pattern'
import { exportResolution, generateVaseMesh, meshLayout, ringBuilder } from '@/geometry/vase-mesh'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { LAYERS, write3dm } from './rhino'
import { naturalInterpolation, vaseSurfaces } from './surface'

const params = (over: Partial<VaseParams> = {}): VaseParams => ({ ...DEFAULT_PARAMS, ...over })
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('naturalInterpolation', () => {
  it('hits every value and has no bend at either end', () => {
    const Q = Array.from({ length: 25 }, (_, i) => Math.sin(i * 0.7) * 10 + i)
    const P = naturalInterpolation(Q)
    expect(P).toHaveLength(Q.length + 2)
    Q.forEach((q, i) => expect((P[i] + 4 * P[i + 1] + P[i + 2]) / 6).toBeCloseTo(q, 10))
    expect(P[0] - 2 * P[1] + P[2]).toBeCloseTo(0, 10)
    const n = P.length
    expect(P[n - 1] - 2 * P[n - 2] + P[n - 3]).toBeCloseTo(0, 10)
  })
})

describe('Surface layer in the .3dm', () => {
  let rhino: RhinoModule
  beforeAll(async () => {
    rhino = await rhino3dm()
  })

  function exportSurfaces(p: VaseParams) {
    const surfaces = vaseSurfaces(p)
    const mesh = generateVaseMesh(p, { segmentsVertical: 16, segmentsRadial: 16 })
    const doc = rhino.File3dm.fromByteArray(write3dm(rhino, { mesh, surfaces }))
    const objects = Array.from({ length: doc.objects().count }, (_, i) => doc.objects().get(i))
    const onSurfaceLayer = objects.filter((o) => o.attributes().layerIndex === 1)
    return { doc, surfaces, geoms: onSurfaceLayer.map((o) => o.geometry() as NurbsSurface), names: onSurfaceLayer.map((o) => o.attributes().name) }
  }

  /** The true vase point at fractional sample index s around and height fraction t (Z-up). */
  function truePoint(p: VaseParams, s: number, t: number) {
    const { cols } = meshLayout(p, exportResolution(p), EXPORT_DETAIL)
    const fine = ringBuilder(p, cols * 2)(t) // half-step samples
    const j = Math.round(s * 2) % (cols * 2)
    return [fine.xs[j], -fine.zs[j], t * p.height]
  }

  /** Largest gap between surface and true vase, halfway between samples in both directions. */
  function maxDeviation(p: VaseParams, s: NurbsSurface) {
    const [, uMax] = s.domain(0)
    const [, vMax] = s.domain(1)
    let worst = 0
    for (let v = 0.5; v < vMax; v += Math.max(1, Math.floor(vMax / 23))) {
      for (let u = 0.5; u < uMax; u += Math.max(1, Math.floor(uMax / 31))) {
        worst = Math.max(worst, dist(s.pointAt(u, v), truePoint(p, u, v / vMax)))
      }
    }
    return worst
  }

  it('adds a "Surface" layer with the outer wall', () => {
    const { doc, names } = exportSurfaces(params())
    expect(doc.layers().get(1).name).toBe(LAYERS.surface.name)
    expect(names).toEqual(['Outer wall'])
  })

  it('solid wall adds the inner wall', () => {
    expect(exportSurfaces(params({ printMode: 'solidWall' })).names).toEqual(['Outer wall', 'Inner wall'])
  })

  it('round sections: seamless (periodic) around, open at base and rim', () => {
    const [s] = exportSurfaces(params()).geoms
    expect(s.isClosed(0)).toBe(true)
    expect(s.isPeriodic(0)).toBe(true)
    expect(s.isClosed(1)).toBe(false)
    expect(s.orderU).toBe(4)
    expect(s.orderV).toBe(4)
  })

  it('passes exactly through the sampled vase points', () => {
    const p = params({ twist: 60, patternType: 'waves' })
    const [s] = exportSurfaces(p).geoms
    const [, vMax] = s.domain(1)
    for (const v of [0, 7, Math.round(vMax / 2), vMax]) {
      for (const u of [0, 3, 50, 101]) expect(dist(s.pointAt(u, v), truePoint(p, u, v / vMax))).toBeLessThan(1e-6)
    }
  })

  it('base edge sits on z = 0 and the rim edge at full height', () => {
    const p = params()
    const [s] = exportSurfaces(p).geoms
    const [, vMax] = s.domain(1)
    for (const u of [0, 10.3, 77.7]) {
      expect(s.pointAt(u, 0)[2]).toBeCloseTo(0, 6)
      expect(s.pointAt(u, vMax)[2]).toBeCloseTo(p.height, 6)
    }
  })

  it('stays within 0.01 mm of the true vase between samples (default bulb)', () => {
    const p = params()
    const [s] = exportSurfaces(p).geoms
    expect(maxDeviation(p, s)).toBeLessThan(0.01)
  })

  it('stays within 0.05 mm with a wave pattern, twist and rolled lip', () => {
    const p = params({ patternType: 'waves', twist: 90, lipType: 'rolled', lipRollRadius: 3 })
    const [s] = exportSurfaces(p).geoms
    expect(maxDeviation(p, s)).toBeLessThan(0.05)
  })

  it('star sections: degree 1 around, so the facets are flat and the corners sharp', () => {
    const p = params({ sectionShape: 'star', sides: 6 })
    const [s] = exportSurfaces(p).geoms
    expect(s.orderU).toBe(2)
    expect(s.isClosed(0)).toBe(true)
    // The true outline halfway (by angle) between two samples lies on the surface's straight facet
    const [, vMax] = s.domain(1)
    const v = Math.round(vMax / 2)
    for (const j of [0, 12, 40]) {
      const a = s.pointAt(j, v)
      const b = s.pointAt(j + 1, v)
      const q = truePoint(p, j + 0.5, v / vMax)
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const aq = [q[0] - a[0], q[1] - a[1], q[2] - a[2]]
      const cross = [ab[1] * aq[2] - ab[2] * aq[1], ab[2] * aq[0] - ab[0] * aq[2], ab[0] * aq[1] - ab[1] * aq[0]]
      expect(Math.hypot(...cross) / Math.hypot(...ab)).toBeLessThan(1e-4) // distance from q to line ab
    }
  })
})
