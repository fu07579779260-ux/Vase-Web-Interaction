import { DEFAULT_PARAMS, SCHEMA_VERSION, vaseParamsSchema, type VaseParams } from '@/model/params'

/**
 * Design files (.json) for backup and sharing:
 *
 *   { "format": "vase-configurator", "version": 1, "name": "...",
 *     "exportedAt": "2026-10-30T06:30:00.000Z", "params": { ... } }
 *
 * On import, parameters missing from older files fall back to defaults; files
 * from a newer app version are refused rather than half-loaded.
 */

export const FORMAT = 'vase-configurator'
// Plenty for one design; anything bigger is not one of ours
export const MAX_FILE_BYTES = 1_000_000

export interface DesignFile {
  format: typeof FORMAT
  version: number
  name: string
  exportedAt: string
  params: VaseParams
}

export function toDesignFile(name: string, params: VaseParams, now = new Date()): string {
  const file: DesignFile = {
    format: FORMAT,
    version: SCHEMA_VERSION,
    name: name.trim() || 'Untitled vase',
    exportedAt: now.toISOString(),
    params,
  }
  return JSON.stringify(file, null, 2)
}

export type ParseResult = { ok: true; name: string; params: VaseParams } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseDesignFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  if (!isObject(data) || data.format !== FORMAT) {
    return { ok: false, error: 'This is not a Vase Configurator design file.' }
  }
  const version = data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'The design file has no valid version number.' }
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `This design was made with a newer version (file v${version}, app v${SCHEMA_VERSION}).` }
  }
  if (!isObject(data.params)) return { ok: false, error: 'The design file contains no parameters.' }

  const result = vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...data.params })
  if (!result.success) {
    const problems = result.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'params'}: ${i.message}`)
    return { ok: false, error: `Some values are invalid — ${problems.join('; ')}.` }
  }
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Imported vase'
  return { ok: true, name, params: result.data }
}
