import type { NumberSpec, Unit } from './params'

/** How parameter values read in the panel. Fractions show as percentages. */

const UNIT_SUFFIX: Record<Unit, string> = {
  mm: ' mm',
  deg: '°',
  'µm': ' µm',
  '×': '×',
  fraction: '%',
  count: '',
  turns: ' turns',
}

const decimals = (step: number) => (step >= 1 ? 0 : Math.min(2, Math.ceil(-Math.log10(step))))

/** Value with its unit, e.g. "40.0 mm", "35%", "1.48×". */
export function formatValue(value: number, spec: Pick<NumberSpec, 'step' | 'unit'>): string {
  if (spec.unit === 'fraction') return `${Math.round(value * 100)}%`
  return value.toFixed(decimals(spec.step)) + UNIT_SUFFIX[spec.unit]
}

/** Just the number, as shown in the edit box ("40.0", "35"). */
export function formatNumber(value: number, spec: Pick<NumberSpec, 'step' | 'unit'>): string {
  if (spec.unit === 'fraction') return `${Math.round(value * 100)}`
  return value.toFixed(decimals(spec.step))
}

/** Range hint, e.g. "20–400 mm, steps of 1". */
export function formatRange(spec: NumberSpec): string {
  const min = formatValue(spec.min, spec)
  const max = formatValue(spec.max, spec)
  const step = spec.unit === 'fraction' ? `${Math.round(spec.step * 100)}%` : `${spec.step}`
  return `${min} – ${max}, steps of ${step}`
}

/**
 * Read a typed value. Units and spaces are ignored and a comma works as the
 * decimal point; fractions are typed as percentages ("35" or "35%" → 0.35).
 * Returns null if it isn't a number. Range limits are left to the store.
 */
export function parseTyped(text: string, unit: Unit): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.+-]/g, '')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return unit === 'fraction' ? n / 100 : n
}
