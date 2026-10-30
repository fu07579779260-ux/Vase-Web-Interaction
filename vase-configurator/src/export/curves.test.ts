import rhino3dm, { type Curve, type RhinoModule } from 'rhino3dm'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateVaseMesh } from '@/geometry/vase-mesh'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { constructionCurves, periodicInterpolation, periodicKnotPoints, type Point } from './curves'
import { LAYERS, write3dm } from './rhino'

const params = (over: Partial<VaseParams> = {}): VaseParams => ({ ...DEFAULT_PARAMS, ...over })
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('periodicInterpolation', () => {
  it('gives control points whose curve passes exactly through the input points', () => {
    const Q: Point[] = Array.from({ length: 37 }, (_, i) => {
      const a = (i / 37) * Math.PI * 2
      const r = 30 + 4 * Math.cos(9 * a) // wavy outline
      return [r * Math.cos(a), r * Math.sin(a), 12]
    })
    const back = periodicKnotPoints(periodicInterpolation(Q))
    back.forEach((p, i) => expect(dist(p, Q[i])).toBeLessThan(1e-9))
  })
})

describe('constructionCurves', () => {
  it('starts with the profile: base radius at z = 0, rim radius at the top', () => {
    const p = params({ bottomRadius: 45, topRadius: 25 })
    const [profile] = constructionCurves(p)
    expect(profile.name).toBe('Profile')
    expect(profile.kind).toBe('openCubic')
    expect(profile.points[0]).toEqual([45, 0, 0])
    const last = profile.points[profile.points.length - 1]
    expect(last[0]).toBeCloseTo(25, 10)
    expect(last[2]).toBe(p.height)
  })

  it('has 17 sections from base to rim, more with a lip, doubled for solid wall', () => {
    const sections = (p: VaseParams) => constructionCurves(p).filter((c) => c.name.startsWith('Section')).length
    expect(sections(params())).toBe(17)
    expect(sections(params({ lipType: 'rolled' }))).toBe(21)
    const solid = constructionCurves(params({ printMode: 'solidWall' }))
    expect(solid.filter((c) => c.name.startsWith('Inner section'))).toHaveLength(17)
  })

  it('uses smooth curves for round sections and closed polylines for sharp ones', () => {
    expect(constructionCurves(params({ sectionShape: 'circle' }))[1].kind).toBe('periodicCubic')
    expect(constructionCurves(params({ sectionShape: 'roundedPolygon' }))[1].kind).toBe('periodicCubic')
    const star = constructionCurves(params({ sectionShape: 'star', sides: 5 }))[1]
    expect(star.kind).toBe('polyline')
    expect(star.points[0]).toEqual(star.points[star.points.length - 1])
  })

  it('sections sit at their stated heights', () => {
    for (const c of constructionCurves(params()).slice(1)) {
      const z = Number(c.name.match(/([\d.]+) mm/)![1])
      // Names round to 0.1 mm
      for (const p of c.points) expect(Math.abs(p[2] - z)).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })
})

describe('Curves layer in the .3dm', () => {
  let rhino: RhinoModule
  beforeAll(async () => {
    rhino = await rhino3dm()
  })

  function exportDoc(p: VaseParams) {
    const curves = constructionCurves(p)
    const mesh = generateVaseMesh(p, { segmentsVertical: 20, segmentsRadial: 32 })
    const doc = rhino.File3dm.fromByteArray(write3dm(rhino, { mesh, curves }))
    const objects = Array.from({ length: doc.objects().count }, (_, i) => doc.objects().get(i))
    return { curves, doc, objects }
  }

  it('adds a "Curves" layer holding every curve, named', () => {
    const { curves, doc, objects } = exportDoc(params())
    expect(doc.layers().count).toBe(2)
    expect(doc.layers().get(1).name).toBe(LAYERS.curves.name)
    const onCurves = objects.filter((o) => o.attributes().layerIndex === 1)
    expect(onCurves.map((o) => o.attributes().name)).toEqual(curves.map((c) => c.name))
  })

  it('a written section curve is closed, periodic and passes through every sampled outline point', () => {
    const p = params({ patternType: 'waves', patternCountAround: 10 })
    const { curves, objects } = exportDoc(p)
    const data = curves[1]
    const curve = objects[2].geometry() as Curve // [0] mesh, [1] profile, [2] first section
    expect(curve.isClosed).toBe(true)
    expect(curve.isPeriodic).toBe(true)

    const targets = periodicKnotPoints(data.points)
    const [t0, t1] = curve.domain
    const n = targets.length
    // Uniform knots: the curve hits one target at each of n equal steps, in order (up to a shift)
    const pts = Array.from({ length: n }, (_, i) => curve.pointAt(t0 + ((t1 - t0) * i) / n))
    const shift = targets.findIndex((q) => dist(q, pts[0]) < 1e-6)
    expect(shift).toBeGreaterThanOrEqual(0)
    pts.forEach((pt, i) => expect(dist(pt, targets[(i + shift) % n])).toBeLessThan(1e-6))
  })

  it('a star section keeps its sharp corners as a closed polyline', () => {
    const { objects } = exportDoc(params({ sectionShape: 'star', sides: 6 }))
    const curve = objects[2].geometry() as Curve
    expect(curve.isClosed).toBe(true)
    expect(curve.degree).toBe(1)
  })

  it('the profile curve runs from the base edge to the rim edge', () => {
    const p = params()
    const { objects } = exportDoc(p)
    const profile = objects[1].geometry() as Curve
    expect(dist(profile.pointAtStart, [p.bottomRadius, 0, 0])).toBeLessThan(1e-9)
    expect(dist(profile.pointAtEnd, [p.topRadius, 0, p.height])).toBeLessThan(1e-6)
  })
})
