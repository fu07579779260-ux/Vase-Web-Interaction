import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type ControlPoint, type VaseParams } from '@/model/params'
import { analyzeVase } from './checks'
import { normalizeControlPoints, presetControlPoints } from './profile'
import { generateVaseMesh } from './vase-mesh'

const RES = { segmentsVertical: 150, segmentsRadial: 48 }
const params = (over: Partial<VaseParams>): VaseParams => ({ ...DEFAULT_PARAMS, ...over })
const analyze = (p: VaseParams) => analyzeVase(p, generateVaseMesh(p, RES))
const ids = (p: VaseParams) => analyze(p).issues.map((i) => i.id)
const points = (pts: [number, number][]): ControlPoint[] => normalizeControlPoints(pts.map(([t, r]) => ({ t, r })))

// Straight 40 mm cylinder, then a ledge that bulges out fast (≈53° outward lean at the bottom)
const bulgeOut = points([[0, 1], [0.1, 2], [0.6, 1], [1, 1]])
// Widens slowly, then pinches in hard (≈69° inward lean) — the outer wall faces up there
const pinchIn = points([[0, 1], [0.5, 1.5], [0.6, 0.5], [1, 1]])
const straight = (over: Partial<VaseParams>) =>
  params({ height: 150, bottomRadius: 40, topRadius: 40, controlPoints: presetControlPoints('cylinder'), ...over })

describe('overhang', () => {
  it('the default vase has no warnings, only the PLA note', () => {
    const { issues } = analyze(DEFAULT_PARAMS)
    expect(issues.filter((i) => i.severity === 'warning')).toEqual([])
    expect(issues.map((i) => i.id)).toEqual(['note:Not water- or food-safe without a coating.'])
  })

  it('a straight cylinder has nothing to flag', () => {
    const a = analyze(straight({}))
    expect(a.overhangFaces).toEqual([])
    expect(a.maxLean).toBeLessThan(0.5)
  })

  it('flags an outward bulge steeper than the material allows, at the right height', () => {
    const a = analyze(straight({ controlPoints: bulgeOut }))
    expect(a.overhangFaces.length).toBeGreaterThan(0)
    expect(a.maxOverhang).toBeGreaterThan(45)
    const issue = a.issues.find((i) => i.id === 'overhang')!
    expect(issue.title).toMatch(/limit 45° for PLA/)
    // The bulge sits in the lower 15 mm
    const low = Number(issue.detail!.match(/Between (\d+)/)![1])
    expect(low).toBeLessThan(15)
  })

  it('vase mode also flags a wall that leans inward (it is a single wall)', () => {
    expect(ids(straight({ controlPoints: pinchIn, printMode: 'vaseMode' }))).toContain('overhang')
  })

  it('solid wall flags the inward pinch on the inner wall, not the outer', () => {
    const p = straight({ controlPoints: pinchIn, printMode: 'solidWall', wallThickness: 2 })
    const mesh = generateVaseMesh(p, RES)
    const a = analyzeVase(p, mesh)
    expect(a.overhangFaces.length).toBeGreaterThan(0)
    const ringVerts = mesh.layout.rows * mesh.layout.cols
    for (const f of a.overhangFaces) expect(mesh.indices[3 * f]).toBeGreaterThanOrEqual(ringVerts)
  })

  it('the limit follows the material: a 40° flare passes PLA but not resin', () => {
    const flare = { lipType: 'flared', lipHeight: 20, lipFlareAngle: 40 } as const
    expect(ids(straight(flare))).not.toContain('overhang')
    expect(ids(straight({ ...flare, material: 'Resin', printerPreset: 'elegooSaturn4', printMode: 'solidWall' }))).toContain(
      'overhang',
    )
  })
})

describe('walls (solid-wall mode)', () => {
  const solid = (over: Partial<VaseParams>) => straight({ printMode: 'solidWall', ...over })

  it('warns when the wall is below the material minimum', () => {
    expect(ids(solid({ wallThickness: 0.6 }))).toContain('thin-wall') // PLA, 0.4 nozzle → 0.8
    expect(ids(solid({ wallThickness: 0.8 }))).not.toContain('thin-wall')
  })

  it('TPU needs 3 × nozzle', () => {
    expect(ids(solid({ wallThickness: 1, material: 'TPU' }))).toContain('thin-wall')
  })

  it('warns when a leaning wall gets too thin measured across it', () => {
    // 0.85 mm passes per layer, but across a ~53° lean it is about 0.5 mm
    expect(ids(solid({ wallThickness: 0.85, controlPoints: bulgeOut }))).toContain('thin-wall-slope')
  })

  it('warns about a thin bottom', () => {
    expect(ids(solid({ bottomThickness: 0.6 }))).toContain('thin-bottom')
  })

  it('warns when the wall fills the neck and the opening closes', () => {
    const p = params({
      printMode: 'solidWall',
      bottomRadius: 10,
      topRadius: 10,
      controlPoints: presetControlPoints('hourglass'), // waist 6 mm
      wallThickness: 6,
    })
    expect(ids(p)).toContain('closed')
  })

  it('vase mode skips the wall checks', () => {
    expect(ids(straight({ wallThickness: 0.4, printMode: 'vaseMode' }))).not.toContain('thin-wall')
  })
})

describe('material and printer combinations', () => {
  const resin = { material: 'Resin', printerPreset: 'elegooSaturn4' } as const

  it('resin in vase mode warns that it prints solid', () => {
    expect(ids(straight({ ...resin, printMode: 'vaseMode' }))).toContain('resin-vase-mode')
  })

  it('hollow resin warns about drain holes once, not also as a note', () => {
    const all = ids(straight({ ...resin, printMode: 'solidWall' }))
    expect(all.filter((id) => /drain/i.test(id))).toEqual(['drain'])
  })

  it('TPU recommends vase mode only when not already using it', () => {
    expect(ids(straight({ material: 'TPU', printMode: 'solidWall', wallThickness: 2 }))).toContain(
      'note:Vase mode recommended.',
    )
    expect(ids(straight({ material: 'TPU', printMode: 'vaseMode' }))).not.toContain('note:Vase mode recommended.')
  })
})
