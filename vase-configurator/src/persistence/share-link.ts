import LZString from 'lz-string'
import { DEFAULT_PARAMS, SCHEMA_VERSION, type VaseParams } from '@/model/params'
import { FORMAT, parseDesignFile, type ParseResult } from './design-file'

/**
 * Share links: the design travels in the URL hash, so nothing is uploaded
 * anywhere and the link works offline.
 *
 *   https://…/#d=<lz-string, URI-safe>
 *
 * Only parameters that differ from the defaults are included, which keeps
 * links short. Decoding goes through the same validation as design files.
 */

const PREFIX = 'd='

interface Payload {
  v: number
  n: string
  p: Partial<VaseParams>
}

/** Parameters that differ from the defaults. */
export function changedParams(params: VaseParams): Partial<VaseParams> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (JSON.stringify(value) !== JSON.stringify(DEFAULT_PARAMS[key as keyof VaseParams])) out[key] = value
  }
  return out as Partial<VaseParams>
}

/** The hash fragment (without '#') for a design. */
export function encodeShareHash(name: string, params: VaseParams): string {
  const payload: Payload = { v: SCHEMA_VERSION, n: name.trim(), p: changedParams(params) }
  return PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function shareUrl(name: string, params: VaseParams, base = window.location.href): string {
  const url = new URL(base)
  url.hash = encodeShareHash(name, params)
  return url.toString()
}

/** True if the hash looks like a share link (with or without the leading '#'). */
export const isShareHash = (hash: string) => hash.replace(/^#/, '').startsWith(PREFIX)

export function decodeShareHash(hash: string): ParseResult {
  const body = hash.replace(/^#/, '')
  if (!body.startsWith(PREFIX)) return { ok: false, error: 'This link does not contain a design.' }
  let payload: unknown
  try {
    const json = LZString.decompressFromEncodedURIComponent(body.slice(PREFIX.length))
    payload = json ? JSON.parse(json) : null
  } catch {
    payload = null
  }
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, error: 'This share link is damaged or incomplete — was it cut off when copying?' }
  }
  const { v, n, p } = payload as Partial<Payload>
  // Same checks as a design file: version, value ranges, defaults for anything missing
  return parseDesignFile(JSON.stringify({ format: FORMAT, version: v, name: n, params: p }))
}
