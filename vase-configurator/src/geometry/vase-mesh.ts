import type { VaseParams } from '@/model/params'
import { lipOffsetFunction, lipZone } from './lip'
import { offsetRing } from './offset'
import { EXPORT_DETAIL, patternFunction, patternMinResolution, type PatternDetail } from './pattern'
import { profileMultiplier } from './profile'
import { sectionFunction, snapRadialSegments } from './section'
import { twistFunction } from './twist'

/**
 * Plain indexed triangle mesh, independent of three.js so the same data can
 * feed the preview, STL export and rhino3dm export.
 * Units: mm. Y is up; the base sits on y = 0. Triangles wind counter-clockwise
 * seen from outside (normals point out).
 */
export interface MeshData {
  positions: Float32Array // xyz per vertex
  indices: Uint32Array // 3 per triangle
  /**
   * How the vertices are laid out, for analysis: `rows` rings of `cols`
   * vertices for the outer wall, then (when hollow) the same for the inner
   * wall, then the cap/floor centres. Side-wall triangles come first, two per
   * quad, outer then inner, band by band.
   */
  layout: { rows: number; cols: number; hollow: boolean }
}

export interface Resolution {
  segmentsVertical: number // number of bands from bottom to top
  segmentsRadial: number // vertices around each ring
}

// Never let the wall collapse onto the axis
const MIN_RADIUS = 0.5

/** Build radius(t) in mm for t ∈ [0, 1]: straight taper × profile curve, plus the lip. */
export function radiusFunction(params: VaseParams): (t: number) => number {
  const multiplier = profileMultiplier(params.controlPoints)
  const lip = lipOffsetFunction(params)
  return (t) => {
    const taper = params.bottomRadius + (params.topRadius - params.bottomRadius) * t
    const base = taper * multiplier(t) + (lip ? lip(t * params.height) : 0)
    return Math.max(MIN_RADIUS, base)
  }
}

/** Preview mesh: half the export counts in each direction (≈¼ of the triangles), never coarser than 32. */
export function previewResolution(params: VaseParams): Resolution {
  if (params.previewAtExportQuality) {
    return { segmentsVertical: params.segmentsVertical, segmentsRadial: params.segmentsRadial }
  }
  return {
    segmentsVertical: Math.max(32, Math.round(params.segmentsVertical / 2)),
    segmentsRadial: Math.max(32, Math.round(params.segmentsRadial / 2)),
  }
}

export interface MeshLayout {
  /** Height fraction of every ring, bottom (0) to top (1) */
  rowT: number[]
  /** Vertices per ring */
  cols: number
}

/**
 * Where the rings go. Vertical count is raised to resolve the pattern; the lip
 * zone gets its own denser rows, since a few mm of bead or flare would
 * otherwise fall between two rings. Radial count is snapped so section
 * corners land on vertices.
 */
export function meshLayout(params: VaseParams, res: Resolution, detail: PatternDetail = EXPORT_DETAIL): MeshLayout {
  const min = patternMinResolution(params, detail)
  const bands = Math.max(res.segmentsVertical, min.vertical)
  const cols = snapRadialSegments(params, Math.max(res.segmentsRadial, min.radial))

  const zone = lipZone(params) / params.height
  if (zone <= 0) return { rowT: Array.from({ length: bands + 1 }, (_, i) => i / bands), cols }

  const bodyEnd = 1 - zone
  const bodyBands = Math.max(1, Math.round(bands * bodyEnd))
  const lipBands = Math.max(Math.round(bands * zone), detail.samplesPerPeriod * LIP_BANDS_PER_SAMPLE)
  const rowT: number[] = []
  for (let i = 0; i <= bodyBands; i++) rowT.push((i / bodyBands) * bodyEnd)
  for (let i = 1; i <= lipBands; i++) rowT.push(bodyEnd + (i / lipBands) * zone)
  rowT[rowT.length - 1] = 1 // exact rim, whatever float rounding did
  return { rowT, cols }
}

// Minimum lip rows = this × samples per period (24 for export, 12 for preview)
const LIP_BANDS_PER_SAMPLE = 3

/** Segment counts the user asked for in the export settings. */
export function exportResolution(params: VaseParams): Resolution {
  return { segmentsVertical: params.segmentsVertical, segmentsRadial: params.segmentsRadial }
}

/** Triangles generateVaseMesh will produce, without building the mesh. */
export function triangleCount(params: VaseParams, res: Resolution, detail: PatternDetail = EXPORT_DETAIL): number {
  const { rowT, cols } = meshLayout(params, res, detail)
  const bands = rowT.length - 1
  return params.printMode === 'solidWall' ? 4 * bands * cols + 4 * cols : 2 * bands * cols + 2 * cols
}

/** Binary STL size: 80-byte header + 4-byte count + 50 bytes per triangle. */
export const stlBytes = (triangles: number) => 84 + 50 * triangles

/** The resolution actually used (see meshLayout). */
export function meshResolution(
  params: VaseParams,
  res: Resolution,
  detail: PatternDetail = EXPORT_DETAIL,
): Resolution {
  const { rowT, cols } = meshLayout(params, res, detail)
  return { segmentsVertical: rowT.length - 1, segmentsRadial: cols }
}

/** Builds the outer surface ring (horizontal x/z, after twist) at any height fraction t. */
export function ringBuilder(params: VaseParams, cols: number) {
  const radiusAt = radiusFunction(params)
  const twistAt = twistFunction(params)
  const pattern = patternFunction(params)

  // Section outline is the same on every ring, so sample it once
  const section = sectionFunction(params)
  const theta = new Float64Array(cols)
  const ringS = new Float64Array(cols)
  const ringCos = new Float64Array(cols)
  const ringSin = new Float64Array(cols)
  for (let j = 0; j < cols; j++) {
    theta[j] = (2 * Math.PI * j) / cols
    ringS[j] = section(theta[j])
    ringCos[j] = Math.cos(theta[j])
    ringSin[j] = Math.sin(theta[j])
  }

  // Section × profile radius, plus the pattern offset, rotated by the twist
  return (t: number) => {
    const xs = new Float64Array(cols)
    const zs = new Float64Array(cols)
    const r = radiusAt(t)
    const phi = twistAt(t)
    const cosPhi = Math.cos(phi)
    const sinPhi = Math.sin(phi)
    for (let j = 0; j < cols; j++) {
      const rho = r * ringS[j] + (pattern ? pattern(theta[j], t) : 0)
      const x = rho * ringCos[j]
      const z = rho * ringSin[j]
      xs[j] = x * cosPhi + z * sinPhi
      zs[j] = z * cosPhi - x * sinPhi
    }
    return { xs, zs }
  }
}

/** Writes triangles into a growing index buffer. */
class IndexWriter {
  k = 0
  readonly indices: Uint32Array
  constructor(indices: Uint32Array) {
    this.indices = indices
  }
  tri(a: number, b: number, c: number) {
    this.indices[this.k++] = a
    this.indices[this.k++] = b
    this.indices[this.k++] = c
  }
}

/**
 * Watertight triangle mesh of the vase, in one of two forms:
 *
 * - vaseMode: closed solid body (side wall + bottom + top cap). The slicer's
 *   spiralize setting turns it into a single wall, so the solid is what it expects.
 * - solidWall: a cup with real thickness — outer wall, inner wall offset inward
 *   by `wallThickness` (horizontally, per layer), a flat rim joining them at the
 *   top, a bottom underneath and a floor `bottomThickness` above it.
 *
 * Ring seams share vertices, so both forms are closed and consistently wound.
 */
export function generateVaseMesh(
  params: VaseParams,
  res: Resolution,
  detail: PatternDetail = EXPORT_DETAIL,
): MeshData {
  const { rowT, cols } = meshLayout(params, res, detail)
  const rows = rowT.length
  const bands = rows - 1
  const hollow = params.printMode === 'solidWall'
  const H = params.height
  const ringAt = ringBuilder(params, cols)

  const ringVerts = rows * cols
  const vertexCount = (hollow ? 2 * ringVerts : ringVerts) + 2
  const triangleCount = hollow ? 4 * bands * cols + 4 * cols : 2 * bands * cols + 2 * cols
  const positions = new Float32Array(vertexCount * 3)
  const out = new IndexWriter(new Uint32Array(triangleCount * 3))

  let p = 0
  const put = (x: number, y: number, z: number) => {
    positions[p++] = x
    positions[p++] = y
    positions[p++] = z
  }

  // Outer wall
  for (const t of rowT) {
    const ring = ringAt(t)
    for (let j = 0; j < cols; j++) put(ring.xs[j], t * H, ring.zs[j])
  }

  // Inner wall: same row layout squeezed between the floor and the rim
  const floorY = Math.min(params.bottomThickness, H / 2)
  if (hollow) {
    for (const t of rowT) {
      const y = floorY + (H - floorY) * t
      const outer = ringAt(y / H)
      const inner = offsetRing(outer.xs, outer.zs, params.wallThickness)
      for (let j = 0; j < cols; j++) put(inner.xs[j], y, inner.zs[j])
    }
  }

  // Centres: bottom of the base, then top cap (vase mode) or floor (solid wall)
  const bottomCenter = p / 3
  put(0, 0, 0)
  const upperCenter = p / 3
  put(0, hollow ? floorY : H, 0)

  const outerV = (i: number, j: number) => i * cols + (j % cols)
  const innerV = (i: number, j: number) => ringVerts + i * cols + (j % cols)
  const top = rows - 1

  for (let i = 0; i < bands; i++) {
    for (let j = 0; j < cols; j++) {
      // Outer faces point away from the axis
      out.tri(outerV(i, j), outerV(i + 1, j), outerV(i, j + 1))
      out.tri(outerV(i, j + 1), outerV(i + 1, j), outerV(i + 1, j + 1))
      if (hollow) {
        // Inner faces point towards the axis: reversed winding
        out.tri(innerV(i, j), innerV(i, j + 1), innerV(i + 1, j))
        out.tri(innerV(i, j + 1), innerV(i + 1, j + 1), innerV(i + 1, j))
      }
    }
  }

  for (let j = 0; j < cols; j++) {
    // Base faces down
    out.tri(bottomCenter, outerV(0, j), outerV(0, j + 1))
    if (hollow) {
      // Rim: flat ring from the outer to the inner top edge, facing up
      out.tri(innerV(top, j), outerV(top, j + 1), outerV(top, j))
      out.tri(innerV(top, j), innerV(top, j + 1), outerV(top, j + 1))
      // Floor faces up
      out.tri(upperCenter, innerV(0, j + 1), innerV(0, j))
    } else {
      // Top cap faces up
      out.tri(upperCenter, outerV(top, j + 1), outerV(top, j))
    }
  }

  return { positions, indices: out.indices, layout: { rows, cols, hollow } }
}
