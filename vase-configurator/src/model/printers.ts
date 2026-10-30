import type { VaseParams } from './params'

/**
 * Printer presets (PLAN 4.8). Build volumes are X × Y × Z in mm.
 * Checked against manufacturer / retailer spec sheets, October 2026.
 * Resin XY resolution uses the finer of the two pixel dimensions.
 */

export type PrinterPreset = VaseParams['printerPreset']
export type PrinterKind = 'fdm' | 'resin'

export interface PrinterSpec {
  label: string
  kind: PrinterKind
  /** Undefined for the two custom entries: they keep whatever the user typed */
  build?: { x: number; y: number; z: number }
  nozzleDiameter?: number
  xyResolution?: number
}

export const PRINTERS: Record<PrinterPreset, PrinterSpec> = {
  bambuP1S: { label: 'Bambu Lab P1S', kind: 'fdm', build: { x: 256, y: 256, z: 256 }, nozzleDiameter: 0.4 },
  bambuX1C: { label: 'Bambu Lab X1 Carbon', kind: 'fdm', build: { x: 256, y: 256, z: 256 }, nozzleDiameter: 0.4 },
  prusaMK4: { label: 'Prusa MK4', kind: 'fdm', build: { x: 250, y: 210, z: 220 }, nozzleDiameter: 0.4 },
  enderV3: { label: 'Creality Ender-3 V3', kind: 'fdm', build: { x: 220, y: 220, z: 250 }, nozzleDiameter: 0.4 },
  elegooSaturn4: {
    label: 'Elegoo Saturn 4',
    kind: 'resin',
    build: { x: 218.88, y: 122.88, z: 220 },
    xyResolution: 19, // 19 × 24 µm
  },
  anycubicM7: {
    label: 'Anycubic Photon Mono M7',
    kind: 'resin',
    build: { x: 223, y: 126, z: 230 },
    xyResolution: 17, // 16.8 × 24.8 µm
  },
  customFDM: { label: 'Custom FDM', kind: 'fdm' },
  customResin: { label: 'Custom resin', kind: 'resin' },
}

export const isCustomPrinter = (p: PrinterPreset) => PRINTERS[p].build === undefined

/** Parameter patch that loads a preset's numbers (custom entries change nothing but the kind). */
export function printerPatch(preset: PrinterPreset): Partial<VaseParams> {
  const spec = PRINTERS[preset]
  return {
    printerPreset: preset,
    ...(spec.build && { buildX: spec.build.x, buildY: spec.build.y, buildZ: spec.build.z }),
    ...(spec.nozzleDiameter !== undefined && { nozzleDiameter: spec.nozzleDiameter }),
    ...(spec.xyResolution !== undefined && { xyResolution: spec.xyResolution }),
  }
}

/** Parameters that describe the printer, not the vase. Changing them rescales the vase rather than being blocked. */
export const PRINTER_KEYS = ['printerPreset', 'buildX', 'buildY', 'buildZ', 'nozzleDiameter', 'xyResolution'] as const
