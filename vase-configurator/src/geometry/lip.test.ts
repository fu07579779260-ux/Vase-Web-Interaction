import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import { fitsPrinter, maxRadius } from './bounds'
import { lipOffsetFunction, lipZone } from './lip'
import { patternFunction } from './pattern'
import { generateVaseMesh, meshLayout, radiusFunction, type MeshData } from './vase-mesh'

const params = (over: Partial<VaseParams>): VaseParams => ({
  ...DEFAULT_PARAMS,
  height: 150,
  lipHeight: 10,
  lipFlareAngle: 30,
  lipRollRadius: 3,
  ...over,
})

describe('lipZone', () => {
  it('is zero without a lip, lipHeight when flared, 2 × roll radius when rolled', () => {
    expect(lipZone(params({ lipType: 'none' }))).toBe(0)
    expect(lipZone(params({ lipType: 'flared' }))).toBe(10)
    expect(lipZone(params({ lipType: 'rolled' }))).toBe(6)
  })

  it('never takes more than half the height', () => {
    expect(lipZone(params({ lipType: 'flared', height: 20, lipHeight: 30 }))).toBe(10)
  })
})

describe('flared lip', () => {
  const f = lipOffsetFunction(params({ lipType: 'flared' }))!
  const tan30 = Math.tan(Math.PI / 6)

  it('is zero below the lip zone and grows to zone·tan/2 at the rim', () => {
    expect(f(100)).toBe(0)
    expect(f(140)).toBe(0)
    expect(f(150)).toBeCloseTo((10 * tan30) / 2, 12)
  })

  it('meets the flare angle exactly at the rim and starts with zero slope', () => {
    const h = 1e-4
    expect((f(150) - f(150 - h)) / h).toBeCloseTo(tan30, 3)
    expect((f(140 + h) - f(140)) / h).toBeCloseTo(0, 3)
  })
})

describe('rolled lip', () => {
  const f = lipOffsetFunction(params({ lipType: 'rolled' }))!

  it('peaks at the roll radius halfway up the bead and returns to 0 at the rim', () => {
    expect(f(144)).toBe(0)
    expect(f(147)).toBeCloseTo(3, 12)
    expect(f(150)).toBeCloseTo(0, 12)
  })

  it('has a 45° underside (printable without support)', () => {
    expect(f(145) - f(144.5)).toBeCloseTo(0.5, 12)
  })
})

describe('lip in the vase', () => {
  it('keeps the total height', () => {
    const mesh = generateVaseMesh(params({ lipType: 'flared' }), { segmentsVertical: 40, segmentsRadial: 48 })
    let maxY = 0
    for (let i = 1; i < mesh.positions.length; i += 3) maxY = Math.max(maxY, mesh.positions[i])
    expect(maxY).toBe(150)
  })

  it('adds the offset to the profile radius', () => {
    const p = params({ lipType: 'flared' })
    const plain = radiusFunction(params({ lipType: 'none' }))
    expect(radiusFunction(p)(1) - plain(1)).toBeCloseTo(lipOffsetFunction(p)!(150), 10)
  })

  it('puts extra rows in the lip zone and ends exactly at the rim', () => {
    const { rowT } = meshLayout(params({ lipType: 'rolled' }), { segmentsVertical: 40, segmentsRadial: 48 })
    const inLip = rowT.filter((t) => t > 1 - 6 / 150).length
    expect(inLip).toBeGreaterThanOrEqual(24)
    expect(rowT[rowT.length - 1]).toBe(1)
    for (let i = 1; i < rowT.length; i++) expect(rowT[i]).toBeGreaterThan(rowT[i - 1])
  })

  it('fades a pattern out across the lip', () => {
    const d = patternFunction(
      params({ lipType: 'flared', patternType: 'ribs', patternAmplitude: 3, patternFadeBottom: 0 }),
    )!
    expect(d(0, 0.5)).toBeCloseTo(3, 12)
    expect(d(0, 1)).toBe(0)
  })

  it('is included in the size used for the printer limit', () => {
    const p = params({ lipType: 'rolled', lipRollRadius: 6 })
    expect(maxRadius(p)).toBeGreaterThanOrEqual(radiusFunction(p)(1 - 6 / 150) - 1e-9)
  })
})

// ---- Mesh-level checks ----

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

describe('lip meshes', () => {
  it.each(['flared', 'rolled'] as const)('%s lip is watertight', (lipType) => {
    const mesh = generateVaseMesh(params({ lipType, patternType: 'spiral', sectionShape: 'star' }), {
      segmentsVertical: 30,
      segmentsRadial: 40,
    })
    expect(isClosed(mesh)).toBe(true)
  })
})

describe('lip and the printer limit', () => {
  beforeEach(() => useVaseStore.getState().reset())

  it('turning on a wide flare on a tight printer shrinks the vase to fit', () => {
    const s = useVaseStore.getState()
    s.applyPrinterPreset('anycubicM7')
    s.setParams({ lipFlareAngle: 45, lipHeight: 30 })
    useVaseStore.getState().setParam('lipType', 'flared')
    expect(fitsPrinter(useVaseStore.getState().params)).toBe(true)
  })
})
