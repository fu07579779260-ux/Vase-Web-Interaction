import type { MeshData } from '@/geometry/vase-mesh'
import { toZUp } from './z-up'

/**
 * Binary STL writer. Units are millimetres (STL has no unit field; slicers
 * assume mm), rotated to Z-up like slicers and CAD expect.
 */

const HEADER_BYTES = 80
const TRIANGLE_BYTES = 50 // normal + 3 vertices (12 floats) + 2-byte attribute

export function meshToStl(mesh: MeshData, header = 'Vase Configurator'): ArrayBuffer {
  const { positions: P, indices: I } = mesh
  const triangles = I.length / 3
  const buffer = new ArrayBuffer(HEADER_BYTES + 4 + TRIANGLE_BYTES * triangles)
  const view = new DataView(buffer)

  // Header: ASCII text, padded with zeros. Must not start with "solid" (ASCII STL marker).
  const text = header.replace(/^solid/i, 'Solid').slice(0, HEADER_BYTES)
  for (let i = 0; i < text.length; i++) view.setUint8(i, text.charCodeAt(i) & 0x7f)
  view.setUint32(HEADER_BYTES, triangles, true)

  let o = HEADER_BYTES + 4
  const Z = toZUp(P)
  const v = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let f = 0; f < triangles; f++) {
    for (let k = 0; k < 3; k++) {
      const s = I[3 * f + k] * 3
      v[3 * k] = Z[s]
      v[3 * k + 1] = Z[s + 1]
      v[3 * k + 2] = Z[s + 2]
    }
    // Facet normal from the (rotated) vertices, right-hand rule
    const e1x = v[3] - v[0]
    const e1y = v[4] - v[1]
    const e1z = v[5] - v[2]
    const e2x = v[6] - v[0]
    const e2y = v[7] - v[1]
    const e2z = v[8] - v[2]
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len

    view.setFloat32(o, nx, true)
    view.setFloat32(o + 4, ny, true)
    view.setFloat32(o + 8, nz, true)
    o += 12
    for (let k = 0; k < 9; k++) {
      view.setFloat32(o, v[k], true)
      o += 4
    }
    view.setUint16(o, 0, true)
    o += 2
  }
  return buffer
}
