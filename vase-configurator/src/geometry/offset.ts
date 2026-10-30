/**
 * Inward offset of one horizontal ring, for the inner wall in solid-wall mode.
 *
 * Wall thickness is measured horizontally, per layer — that is what a slicer
 * fills with perimeters, so it is the number that matters for printing.
 *
 * The inner outline is built in polar form: along each outer vertex's
 * direction from the axis, find the largest radius whose point is still at
 * least `w` from every nearby outer segment. That gives exact mitred corners
 * on convex shapes, rounded valleys on concave ones (star, ribs), and an
 * inner outline that can never fold over itself.
 */

// The inner wall never closes completely onto the axis
export const MIN_INNER_RADIUS = 0.5

/**
 * @param xs, zs outer ring (horizontal coordinates), star-shaped around the axis
 * @param w      wall thickness in mm
 * @returns      inner ring at the same directions
 */
export function offsetRing(xs: ArrayLike<number>, zs: ArrayLike<number>, w: number): { xs: Float64Array; zs: Float64Array } {
  const n = xs.length
  const outX = new Float64Array(n)
  const outZ = new Float64Array(n)

  let rMin = Infinity
  for (let j = 0; j < n; j++) rMin = Math.min(rMin, Math.hypot(xs[j], zs[j]))

  // Segments that can lie within w of the inner point: a disc of radius w at
  // radius ≥ rMin − w spans at most asin(w / that) either side
  const inner = Math.max(rMin - w, MIN_INNER_RADIUS)
  const span = w >= inner ? Math.PI : Math.asin(w / inner)
  const window = Math.min(Math.ceil(n / 2), Math.ceil((span / (2 * Math.PI)) * n) + 2)

  for (let j = 0; j < n; j++) {
    const r = Math.hypot(xs[j], zs[j])
    const ux = xs[j] / r
    const uz = zs[j] / r
    let rho = r - w // what a smooth wall would give; constraints below only lower it

    for (let d = -window; d < window; d++) {
      const a = (j + d + n) % n
      const b = (a + 1) % n
      rho = Math.min(rho, maxRadiusFromSegment(ux, uz, xs[a], zs[a], xs[b], zs[b], w, r))
    }

    rho = Math.max(MIN_INNER_RADIUS, rho)
    outX[j] = rho * ux
    outZ[j] = rho * uz
  }
  return { xs: outX, zs: outZ }
}

/**
 * Largest ρ ≤ rLimit such that the point ρ·u is at least w away from the
 * segment AB (on the axis side). Returns rLimit when the segment doesn't
 * constrain the ray.
 */
function maxRadiusFromSegment(
  ux: number,
  uz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  w: number,
  rLimit: number,
): number {
  let best = rLimit

  // Endpoint A as a circle of radius w: solve |ρu − A| = w, take the near root
  const ua = ux * ax + uz * az
  const perp2 = ax * ax + az * az - ua * ua
  if (perp2 < w * w && ua > 0) best = Math.min(best, ua - Math.sqrt(w * w - perp2))

  // Segment interior: line through A, B at distance w
  const ex = bx - ax
  const ez = bz - az
  const len = Math.hypot(ex, ez)
  if (len < 1e-12) return best
  // Outward normal (away from the axis) of the segment
  let nx = ez / len
  let nz = -ex / len
  if (nx * ax + nz * az < 0) {
    nx = -nx
    nz = -nz
  }
  const un = ux * nx + uz * nz
  if (un <= 1e-9) return best // ray runs parallel to or away from this face
  const dLine = nx * ax + nz * az
  const rho = (dLine - w) / un
  // Only valid if the closest point on the line falls inside the segment
  const px = rho * ux - ax
  const pz = rho * uz - az
  const s = (px * ex + pz * ez) / (len * len)
  if (s >= 0 && s <= 1) best = Math.min(best, rho)
  return best
}
