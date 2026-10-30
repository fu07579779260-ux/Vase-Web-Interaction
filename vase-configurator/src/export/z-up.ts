/**
 * The scene is Y-up; STL and Rhino are Z-up. Rotate +90° about X:
 * (x, y, z) → (x, −z, y). A proper rotation, so winding and normals stay valid.
 */
export function toZUp(positions: Float32Array): Float32Array {
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = positions[i]
    out[i + 1] = -positions[i + 2]
    out[i + 2] = positions[i + 1]
  }
  return out
}
