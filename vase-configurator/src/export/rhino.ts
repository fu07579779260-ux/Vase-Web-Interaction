import type { File3dm, GeometryBase, RhinoModule } from 'rhino3dm'
import type { MeshData } from '@/geometry/vase-mesh'
import type { CurveData } from './curves'
import type { SurfaceData } from './surface'
import { toZUp } from './z-up'

/**
 * .3dm writer (rhino3dm). Model units are millimetres and the model is Z-up,
 * like Rhino itself. Each kind of geometry goes on its own named layer
 * (PLAN: Mesh, Surface, Curves).
 *
 * Files are written in Rhino 7 format: Rhino 7 and Rhino 8 both open it,
 * while the library default (Rhino 8 format) does not open in Rhino 7.
 */

export const RHINO_FILE_VERSION = 7

interface LayerSpec {
  name: string
  color: { r: number; g: number; b: number; a: number }
}

export const LAYERS = {
  mesh: { name: 'Mesh', color: { r: 120, g: 120, b: 120, a: 255 } },
  surface: { name: 'Surface', color: { r: 217, g: 119, b: 6, a: 255 } },
  curves: { name: 'Curves', color: { r: 37, g: 99, b: 235, a: 255 } },
} satisfies Record<string, LayerSpec>

// Embind objects live on the WASM heap and must be freed by hand
type Deletable = { delete(): void }
const free = (...objects: unknown[]) => objects.forEach((o) => (o as Deletable).delete())

function addLayer(rhino: RhinoModule, doc: File3dm, spec: LayerSpec): number {
  const layer = new rhino.Layer()
  layer.name = spec.name
  layer.color = spec.color
  const index = doc.layers().add(layer)
  free(layer)
  return index
}

function toRhinoMesh(rhino: RhinoModule, mesh: MeshData) {
  const P = toZUp(mesh.positions)
  const I = mesh.indices
  const m = new rhino.Mesh()
  const vertices = m.vertices()
  for (let i = 0; i < P.length; i += 3) vertices.add(P[i], P[i + 1], P[i + 2])
  const faces = m.faces()
  for (let f = 0; f < I.length; f += 3) faces.addTriFace(I[f], I[f + 1], I[f + 2])
  m.normals().computeNormals()
  m.compact()
  return m
}

function toRhinoCurve(rhino: RhinoModule, curve: CurveData) {
  switch (curve.kind) {
    case 'polyline':
      return new rhino.PolylineCurve(curve.points)
    case 'openCubic':
      return rhino.NurbsCurve.create(false, 3, curve.points)
    case 'periodicCubic':
      return rhino.NurbsCurve.create(true, 3, curve.points)
  }
}

function toRhinoSurface(rhino: RhinoModule, s: SurfaceData) {
  const surface = rhino.NurbsSurface.create(3, false, s.degreeU + 1, s.degreeV + 1, s.countU, s.countV)
  const knotsU = surface.knotsU()
  s.knotsU.forEach((k, i) => knotsU.set(i, k))
  const knotsV = surface.knotsV()
  s.knotsV.forEach((k, i) => knotsV.set(i, k))
  const points = surface.points()
  const P = s.points
  for (let u = 0; u < s.countU; u++) {
    for (let v = 0; v < s.countV; v++) {
      const o = (u * s.countV + v) * 3
      // The typings say [x, y, z], but the binding takes homogeneous [x, y, z, w]; w = 1 (non-rational)
      points.set(u, v, [P[o], P[o + 1], P[o + 2], 1])
    }
  }
  free(knotsU, knotsV, points)
  return surface
}

function addObject(rhino: RhinoModule, doc: File3dm, geometry: GeometryBase, layerIndex: number, name: string) {
  const attributes = new rhino.ObjectAttributes()
  attributes.layerIndex = layerIndex
  attributes.name = name
  doc.objects().add(geometry, attributes)
  free(geometry, attributes)
}

export interface RhinoExport {
  mesh: MeshData
  /** NURBS surfaces for the Surface layer (omit to leave the layer out) */
  surfaces?: SurfaceData[]
  /** Construction curves for the Curves layer (omit to leave the layer out) */
  curves?: CurveData[]
  /** Object name shown in Rhino's properties panel */
  name?: string
}

/** Build a .3dm file in memory. */
export function write3dm(rhino: RhinoModule, { mesh, surfaces, curves, name = 'Vase' }: RhinoExport): Uint8Array {
  const doc = new rhino.File3dm()
  doc.applicationName = 'Vase Configurator'
  doc.settings().modelUnitSystem = rhino.UnitSystem.Millimeters

  const meshLayer = addLayer(rhino, doc, LAYERS.mesh)
  addObject(rhino, doc, toRhinoMesh(rhino, mesh), meshLayer, `${name} mesh`)

  if (surfaces?.length) {
    const surfaceLayer = addLayer(rhino, doc, LAYERS.surface)
    for (const s of surfaces) addObject(rhino, doc, toRhinoSurface(rhino, s), surfaceLayer, s.name)
  }

  if (curves?.length) {
    const curveLayer = addLayer(rhino, doc, LAYERS.curves)
    for (const curve of curves) addObject(rhino, doc, toRhinoCurve(rhino, curve), curveLayer, curve.name)
  }

  const options = new rhino.File3dmWriteOptions()
  options.version = RHINO_FILE_VERSION
  const bytes = doc.toByteArrayOptions(options)
  free(options, doc)
  return bytes
}
