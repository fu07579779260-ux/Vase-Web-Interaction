import { MATERIALS } from '@/model/materials'
import type { VaseParams } from '@/model/params'
import { PRINTERS } from '@/model/printers'
import { MIN_INNER_RADIUS } from './offset'
import type { MeshData } from './vase-mesh'

/**
 * Printability checks (PLAN 5: everything except build volume warns, never blocks).
 *
 * Overhang = how far a side wall leans from vertical, in degrees.
 * - Vase mode prints the outer surface as a single wall, so leaning either
 *   way (outward or inward) is an overhang.
 * - Solid wall: an outer face pointing down overhangs outward; an inner face
 *   pointing down overhangs into the opening (e.g. under a narrowing neck).
 *   Upward-facing faces of a thick wall are just top surfaces.
 */

export type Severity = 'warning' | 'info'

export interface Issue {
  id: string
  severity: Severity
  title: string
  detail?: string
}

export interface Analysis {
  issues: Issue[]
  /** Indices of overhanging triangles in the mesh (for the red overlay) */
  overhangFaces: number[]
  /** Steepest lean found on any side wall, degrees */
  maxLean: number
  /** Worst lean that counts as an overhang for this print mode, degrees */
  maxOverhang: number
}

const DEG = 180 / Math.PI
// Ignore tiny excesses from faceting
const TOLERANCE_DEG = 0.5

const fmt = (n: number, digits = 1) => `${+n.toFixed(digits)}`

export function analyzeVase(params: VaseParams, mesh: MeshData): Analysis {
  const { positions: P, indices: I, layout } = mesh
  const { rows, cols, hollow } = layout
  const ringVerts = rows * cols
  const sideTriangles = (rows - 1) * cols * (hollow ? 4 : 2)
  const material = MATERIALS[params.material]
  const limit = material.maxOverhang
  const sinLimit = Math.sin((limit + TOLERANCE_DEG) / DEG)

  const overhangFaces: number[] = []
  let maxLean = 0
  let maxOverhang = 0
  let flaggedLow = Infinity
  let flaggedHigh = -Infinity

  for (let f = 0; f < sideTriangles; f++) {
    const a = I[3 * f]
    const b = I[3 * f + 1]
    const c = I[3 * f + 2]
    const [ax, ay, az] = [P[3 * a], P[3 * a + 1], P[3 * a + 2]]
    const e1x = P[3 * b] - ax
    const e1y = P[3 * b + 1] - ay
    const e1z = P[3 * b + 2] - az
    const e2x = P[3 * c] - ax
    const e2y = P[3 * c + 1] - ay
    const e2z = P[3 * c + 2] - az
    // Face normal (winding points it out of the material)
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-12) continue
    const sy = ny / len // sine of the lean from vertical

    const lean = Math.asin(Math.min(1, Math.abs(sy))) * DEG
    const inner = a >= ringVerts
    if (!inner) maxLean = Math.max(maxLean, lean)

    // Which lean counts as an overhang for this face
    const overhangSin = hollow ? Math.max(0, -sy) : inner ? 0 : Math.abs(sy)
    maxOverhang = Math.max(maxOverhang, Math.asin(Math.min(1, overhangSin)) * DEG)
    if (overhangSin > sinLimit) {
      overhangFaces.push(f)
      flaggedLow = Math.min(flaggedLow, ay, P[3 * b + 1], P[3 * c + 1])
      flaggedHigh = Math.max(flaggedHigh, ay, P[3 * b + 1], P[3 * c + 1])
    }
  }

  const issues: Issue[] = []

  if (flaggedHigh >= flaggedLow) {
    issues.push({
      id: 'overhang',
      severity: 'warning',
      title: `Overhang up to ${fmt(maxOverhang, 0)}° (limit ${limit}° for ${material.label})`,
      detail: `Between ${fmt(flaggedLow, 0)} and ${fmt(flaggedHigh, 0)} mm height, shown in red. Expect sagging or add support.`,
    })
  }

  const isResin = PRINTERS[params.printerPreset].kind === 'resin'

  if (hollow) {
    const minWall = material.minWall(params.nozzleDiameter)
    if (params.wallThickness < minWall - 1e-9) {
      issues.push({
        id: 'thin-wall',
        severity: 'warning',
        title: `Wall ${fmt(params.wallThickness, 2)} mm is below the ${material.label} minimum (${fmt(minWall, 2)} mm)`,
      })
    } else {
      // Thickness across a leaning wall is less than the horizontal thickness
      const across = params.wallThickness * Math.cos(maxLean / DEG)
      if (across < minWall - 1e-9) {
        issues.push({
          id: 'thin-wall-slope',
          severity: 'warning',
          title: `Wall is only ${fmt(across, 2)} mm thick where it leans ${fmt(maxLean, 0)}°`,
          detail: `${material.label} needs ${fmt(minWall, 2)} mm. Measured across the wall rather than per layer.`,
        })
      }
    }

    if (params.bottomThickness < minWall - 1e-9) {
      issues.push({
        id: 'thin-bottom',
        severity: 'warning',
        title: `Bottom ${fmt(params.bottomThickness, 2)} mm is below the ${material.label} minimum (${fmt(minWall, 2)} mm)`,
      })
    }

    // Inner wall squeezed onto the axis: the opening closes
    let closedLow = Infinity
    for (let v = ringVerts; v < 2 * ringVerts; v++) {
      if (Math.hypot(P[3 * v], P[3 * v + 2]) <= MIN_INNER_RADIUS + 1e-3) closedLow = Math.min(closedLow, P[3 * v + 1])
    }
    if (closedLow < Infinity) {
      issues.push({
        id: 'closed',
        severity: 'warning',
        title: `The opening closes up from ${fmt(closedLow, 0)} mm height`,
        detail: 'The wall is thicker than the vase is wide there. Use a thinner wall or a wider neck.',
      })
    }

    if (isResin) {
      issues.push({
        id: 'drain',
        severity: 'warning',
        title: 'Hollow resin parts need drain holes',
        detail: 'Trapped resin can crack the print. Add holes in your slicer before printing.',
      })
    }
  } else if (isResin) {
    issues.push({
      id: 'resin-vase-mode',
      severity: 'warning',
      title: 'Resin printers have no vase mode',
      detail: 'This will print as a solid block, which uses a lot of resin. Switch to Solid wall.',
    })
  }

  // Remaining material notes, unless a warning above already covers them
  for (const note of material.notes) {
    if (isResin && /drain holes/i.test(note)) continue
    if (!hollow && /vase mode recommended/i.test(note)) continue
    issues.push({ id: `note:${note}`, severity: 'info', title: note })
  }

  return { issues, overhangFaces, maxLean, maxOverhang }
}
