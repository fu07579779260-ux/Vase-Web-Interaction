import { z } from 'zod'
import { PROFILE_PRESETS, ZONE_LIMITS, presetControlPoints, zoneValues } from '@/geometry/profile'

/**
 * Single source of truth for every vase parameter: units, ranges, defaults.
 * Mirrors PLAN.md section 4. Lengths are mm, angles are degrees.
 */

export const SCHEMA_VERSION = 1

export type Unit = 'mm' | 'deg' | 'µm' | '×' | 'fraction' | 'count' | 'turns'

export interface NumberSpec {
  label: string
  unit: Unit
  min: number
  max: number
  step: number
  default: number
}

export const NUMBER_PARAMS = {
  // 4.1 Basic dimensions (further clamped by printer build volume)
  height: { label: 'Height', unit: 'mm', min: 20, max: 400, step: 1, default: 150 },
  bottomRadius: { label: 'Bottom radius', unit: 'mm', min: 10, max: 150, step: 0.5, default: 40 },
  topRadius: { label: 'Top radius', unit: 'mm', min: 5, max: 150, step: 0.5, default: 30 },

  // 4.2 Profile zone sliders — mirror the belly/neck control points (position = t, width = r)
  bellyPosition: { label: 'Belly position', unit: 'fraction', ...ZONE_LIMITS.bellyPosition, step: 0.01, default: 0.35 },
  bellyWidth: { label: 'Belly width', unit: '×', ...ZONE_LIMITS.bellyWidth, step: 0.01, default: 1.48 },
  neckPosition: { label: 'Neck position', unit: 'fraction', ...ZONE_LIMITS.neckPosition, step: 0.01, default: 0.8 },
  neckWidth: { label: 'Neck width', unit: '×', ...ZONE_LIMITS.neckWidth, step: 0.01, default: 0.88 },

  // 4.3 Cross-section
  sides: { label: 'Sides / points', unit: 'count', min: 3, max: 24, step: 1, default: 6 },
  starDepth: { label: 'Star depth', unit: 'fraction', min: 0.05, max: 0.5, step: 0.01, default: 0.2 },
  cornerRounding: { label: 'Corner rounding', unit: 'fraction', min: 0, max: 1, step: 0.01, default: 0.3 },

  // 4.4 Twist
  twist: { label: 'Twist', unit: 'deg', min: -360, max: 360, step: 1, default: 0 },

  // 4.5 Surface pattern
  patternAmplitude: { label: 'Amplitude', unit: 'mm', min: 0, max: 8, step: 0.1, default: 2 },
  patternCountAround: { label: 'Count around', unit: 'count', min: 2, max: 64, step: 1, default: 12 },
  patternCountVertical: { label: 'Count vertical', unit: 'count', min: 0, max: 20, step: 1, default: 4 },
  spiralTurns: { label: 'Spiral turns', unit: 'turns', min: 0.25, max: 5, step: 0.05, default: 1 },
  patternFadeBottom: { label: 'Fade at bottom', unit: 'mm', min: 0, max: 50, step: 1, default: 5 },

  // 4.6 Lip / rim
  // Defaults give a clearly visible flare (~4 mm outward); 8 mm / 15° was barely noticeable
  lipHeight: { label: 'Lip height', unit: 'mm', min: 2, max: 30, step: 0.5, default: 15 },
  lipFlareAngle: { label: 'Flare angle', unit: 'deg', min: 0, max: 45, step: 1, default: 30 },
  lipRollRadius: { label: 'Roll radius', unit: 'mm', min: 1, max: 6, step: 0.1, default: 2 },

  // 4.7 Print mode
  wallThickness: { label: 'Wall thickness', unit: 'mm', min: 0.4, max: 6, step: 0.1, default: 2 },
  bottomThickness: { label: 'Bottom thickness', unit: 'mm', min: 0.6, max: 6, step: 0.1, default: 1.2 },

  // 4.8 Printer (defaults = Bambu Lab P1S; preset table arrives in build step 9)
  buildX: { label: 'Build X', unit: 'mm', min: 50, max: 1000, step: 1, default: 256 },
  buildY: { label: 'Build Y', unit: 'mm', min: 50, max: 1000, step: 1, default: 256 },
  buildZ: { label: 'Build Z', unit: 'mm', min: 50, max: 1000, step: 1, default: 256 },
  nozzleDiameter: { label: 'Nozzle', unit: 'mm', min: 0.2, max: 1.2, step: 0.05, default: 0.4 },
  xyResolution: { label: 'XY resolution', unit: 'µm', min: 10, max: 100, step: 1, default: 50 },

  // 4.10 Export quality
  segmentsVertical: { label: 'Vertical segments', unit: 'count', min: 16, max: 1024, step: 1, default: 200 },
  segmentsRadial: { label: 'Radial segments', unit: 'count', min: 16, max: 1024, step: 1, default: 180 },
} as const satisfies Record<string, NumberSpec>

export const ENUM_PARAMS = {
  profilePreset: PROFILE_PRESETS,
  sectionShape: ['circle', 'polygon', 'star', 'roundedPolygon'],
  twistEasing: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
  patternType: ['none', 'waves', 'ribs', 'spiral'],
  lipType: ['none', 'flared', 'rolled'],
  printMode: ['vaseMode', 'solidWall'],
  printerPreset: [
    'bambuP1S',
    'bambuX1C',
    'prusaMK4',
    'enderV3',
    'elegooSaturn4',
    'anycubicM7',
    'customFDM',
    'customResin',
  ],
  material: ['PLA', 'PETG', 'TPU', 'Resin'],
  qualityPreset: ['draft', 'normal', 'fine', 'custom'],
} as const

export type NumberParamKey = keyof typeof NUMBER_PARAMS
export type EnumParamKey = keyof typeof ENUM_PARAMS

/** Segment counts per export quality preset (PLAN 4.10). */
export const QUALITY_PRESETS = {
  draft: { segmentsVertical: 64, segmentsRadial: 64 },
  normal: { segmentsVertical: 200, segmentsRadial: 180 },
  fine: { segmentsVertical: 500, segmentsRadial: 400 },
} as const

export type QualityPreset = (typeof ENUM_PARAMS.qualityPreset)[number]

/** The preset whose segment counts these are, or "custom". */
export function matchingQualityPreset(p: { segmentsVertical: number; segmentsRadial: number }): QualityPreset {
  for (const [name, counts] of Object.entries(QUALITY_PRESETS)) {
    if (counts.segmentsVertical === p.segmentsVertical && counts.segmentsRadial === p.segmentsRadial) {
      return name as QualityPreset
    }
  }
  return 'custom'
}

/** Profile control point: t = height fraction (0 bottom → 1 top), r = radius multiplier. */
export const CONTROL_POINT_LIMITS = { minPoints: 4, maxPoints: 8, rMin: 0.2, rMax: 2.5 } as const

// ---- Zod schema (validates JSON imports and share URLs) ----

const numberField = (spec: NumberSpec) => z.number().min(spec.min).max(spec.max)

const numberShape = Object.fromEntries(
  Object.entries(NUMBER_PARAMS).map(([key, spec]) => [key, numberField(spec)]),
) as { [K in NumberParamKey]: z.ZodNumber }

// fromEntries loses the per-key enum types, so restore them explicitly
const enumShape = Object.fromEntries(
  Object.entries(ENUM_PARAMS).map(([key, values]) => [key, z.enum(values)]),
) as unknown as { [K in EnumParamKey]: z.ZodEnum<{ [V in (typeof ENUM_PARAMS)[K][number]]: V }> }

export const controlPointSchema = z.object({
  t: z.number().min(0).max(1),
  r: z.number().min(CONTROL_POINT_LIMITS.rMin).max(CONTROL_POINT_LIMITS.rMax),
  /** Which zone slider moves this point, if any */
  role: z.enum(['belly', 'neck']).optional(),
})

export const vaseParamsSchema = z.object({
  ...numberShape,
  ...enumShape,
  controlPoints: z
    .array(controlPointSchema)
    .min(CONTROL_POINT_LIMITS.minPoints)
    .max(CONTROL_POINT_LIMITS.maxPoints),
  materialColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  previewAtExportQuality: z.boolean(),
})

export type VaseParams = z.infer<typeof vaseParamsSchema>
export type ControlPoint = z.infer<typeof controlPointSchema>

// ---- Defaults ----

const numberDefaults = Object.fromEntries(
  Object.entries(NUMBER_PARAMS).map(([key, spec]) => [key, spec.default]),
) as { [K in NumberParamKey]: number }

export const DEFAULT_PARAMS: VaseParams = {
  ...numberDefaults,
  profilePreset: 'bulb',
  sectionShape: 'circle',
  twistEasing: 'linear',
  patternType: 'none',
  lipType: 'none',
  printMode: 'vaseMode',
  printerPreset: 'bambuP1S',
  material: 'PLA',
  qualityPreset: 'normal',
  controlPoints: presetControlPoints('bulb'),
  // Zone sliders mirror the bulb's belly/neck points exactly
  ...zoneValues(presetControlPoints('bulb')),
  materialColor: '#d8d2c8',
  previewAtExportQuality: false,
}

// ---- Helpers ----

export function isNumberParam(key: string): key is NumberParamKey {
  return key in NUMBER_PARAMS
}

/** Clamp to the parameter's static range (printer limits are applied separately). */
export function clampParam(key: NumberParamKey, value: number): number {
  const { min, max } = NUMBER_PARAMS[key]
  if (!Number.isFinite(value)) return NUMBER_PARAMS[key].default
  return Math.min(max, Math.max(min, value))
}
