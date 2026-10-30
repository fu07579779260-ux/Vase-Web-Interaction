import rhino3dm, { type Mesh, type RhinoModule } from 'rhino3dm'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateVaseMesh } from '@/geometry/vase-mesh'
import { DEFAULT_PARAMS, type VaseParams } from '@/model/params'
import { LAYERS, RHINO_FILE_VERSION, write3dm } from './rhino'

const RES = { segmentsVertical: 20, segmentsRadial: 32 }

let rhino: RhinoModule
beforeAll(async () => {
  rhino = await rhino3dm()
})

function roundTrip(params: VaseParams) {
  const mesh = generateVaseMesh(params, RES)
  const bytes = write3dm(rhino, { mesh })
  const doc = rhino.File3dm.fromByteArray(bytes)
  return { mesh, bytes, doc }
}

describe('write3dm', () => {
  it('writes a file rhino3dm can read back, in Rhino 7 format', () => {
    const { bytes, doc } = roundTrip(DEFAULT_PARAMS)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(doc).toBeTruthy()
    expect(Math.floor(doc.archiveVersion / 10)).toBe(RHINO_FILE_VERSION)
  })

  it('uses millimetres', () => {
    const { doc } = roundTrip(DEFAULT_PARAMS)
    expect(doc.settings().modelUnitSystem).toBe(rhino.UnitSystem.Millimeters)
  })

  it('puts the mesh on a layer named "Mesh"', () => {
    const { doc } = roundTrip(DEFAULT_PARAMS)
    expect(doc.layers().count).toBe(1)
    const layer = doc.layers().get(0)
    expect(layer.name).toBe(LAYERS.mesh.name)
    expect(doc.objects().count).toBe(1)
    const obj = doc.objects().get(0)
    expect(obj.attributes().layerIndex).toBe(0)
    expect(obj.attributes().name).toBe('Vase mesh')
  })

  it.each([
    ['vase mode', {}],
    ['solid wall', { printMode: 'solidWall' }],
  ] as const)('keeps every vertex and triangle, closed (%s)', (_, over) => {
    const { mesh, doc } = roundTrip({ ...DEFAULT_PARAMS, ...over })
    const m = doc.objects().get(0).geometry() as Mesh
    expect(m.vertices().count).toBe(mesh.positions.length / 3)
    expect(m.faces().count).toBe(mesh.indices.length / 3)
    expect(m.isClosed).toBe(true)
  })

  it('is Z-up: the base on z = 0, the rim at the vase height', () => {
    const { doc } = roundTrip(DEFAULT_PARAMS)
    const m = doc.objects().get(0).geometry() as Mesh
    const bbox = m.getBoundingBox(true)
    expect(bbox.min[2]).toBeCloseTo(0, 4)
    expect(bbox.max[2]).toBeCloseTo(DEFAULT_PARAMS.height, 3)
  })
})
