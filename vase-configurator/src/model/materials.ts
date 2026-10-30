import type { VaseParams } from './params'
import type { PrinterKind } from './printers'

/**
 * Material table (PLAN 4.9): print rules, preview finish and notes.
 * Rule values are conservative starting points — edit them here, in one place.
 */

export type Material = VaseParams['material']

export interface Finish {
  roughness: number
  clearcoat?: number
  /** 0 = opaque, 1 = fully see-through */
  transmission?: number
  /** Soft cloth-like highlight, for flexible filament */
  sheen?: number
}

export interface MaterialSpec {
  label: string
  kind: PrinterKind
  /** Minimum wall thickness in mm; FDM rules scale with the nozzle */
  minWall: (nozzleDiameter: number) => number
  /** How the min-wall rule reads in the UI */
  minWallRule: string
  /** Steepest printable overhang without support, degrees from vertical */
  maxOverhang: number
  finishLabel: string
  finish: Finish
  defaultColor: string
  notes: string[]
}

export const MATERIALS: Record<Material, MaterialSpec> = {
  PLA: {
    label: 'PLA',
    kind: 'fdm',
    minWall: (nozzle) => 2 * nozzle,
    minWallRule: '2 × nozzle',
    maxOverhang: 45,
    finishLabel: 'Matte',
    finish: { roughness: 0.6 },
    defaultColor: '#d8d2c8',
    notes: ['Not water- or food-safe without a coating.'],
  },
  PETG: {
    label: 'PETG',
    kind: 'fdm',
    minWall: (nozzle) => 2 * nozzle,
    minWallRule: '2 × nozzle',
    maxOverhang: 40,
    finishLabel: 'Satin',
    finish: { roughness: 0.32, clearcoat: 0.3 },
    defaultColor: '#7fa9bd',
    notes: [],
  },
  TPU: {
    label: 'TPU',
    kind: 'fdm',
    minWall: (nozzle) => 3 * nozzle,
    minWallRule: '3 × nozzle',
    maxOverhang: 35,
    finishLabel: 'Matte, soft',
    finish: { roughness: 0.8, sheen: 0.6 },
    defaultColor: '#3f3f46',
    notes: ['Thin walls may sag.', 'Vase mode recommended.'],
  },
  Resin: {
    label: 'Resin',
    kind: 'resin',
    minWall: () => 0.8,
    minWallRule: '0.8 mm',
    maxOverhang: 30,
    finishLabel: 'Glossy, translucent',
    finish: { roughness: 0.12, clearcoat: 1, transmission: 0.35 },
    defaultColor: '#c8b7a6',
    notes: ['Hollow solid-wall parts need drain holes.', 'Wash and cure after printing.'],
  },
}

/** The material a printer type falls back to when the current one doesn't fit it. */
export const DEFAULT_MATERIAL: Record<PrinterKind, Material> = { fdm: 'PLA', resin: 'Resin' }

/** Patch that switches material and resets the colour to the material's default. */
export function materialPatch(material: Material): Partial<VaseParams> {
  return { material, materialColor: MATERIALS[material].defaultColor }
}
