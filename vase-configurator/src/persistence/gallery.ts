import { z } from 'zod'
import { SCHEMA_VERSION } from '@/model/params'

/**
 * Saved designs, kept in this browser's localStorage (no account, no server).
 * Parameters are stored as-is and validated by the store when a design is
 * opened, so a damaged entry can't break the app — it just won't open.
 */

export interface SavedDesign {
  id: string
  name: string
  /** Raw parameters; validated on open */
  params: unknown
  /** Small JPEG data URL, or empty when none could be captured */
  thumbnail: string
  createdAt: number
  updatedAt: number
  version: number
}

const KEY = 'vase-configurator:designs'

const entrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  params: z.unknown(),
  thumbnail: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number(),
})

/** Minimal Storage surface, so tests can pass an in-memory one. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

/** localStorage when the browser allows it (private modes or blocked site data may not). */
export function browserStorage(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage
    const probe = '__vase_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

function readAll(storage: KeyValueStore | null): SavedDesign[] {
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    // Keep every well-formed entry; skip anything damaged
    return raw.flatMap((e) => {
      const r = entrySchema.safeParse(e)
      return r.success ? [r.data as SavedDesign] : []
    })
  } catch {
    return []
  }
}

/** Write the full list. Returns false when storage is unavailable or full. */
function writeAll(storage: KeyValueStore | null, designs: SavedDesign[]): boolean {
  if (!storage) return false
  try {
    storage.setItem(KEY, JSON.stringify(designs))
    return true
  } catch {
    return false
  }
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Most recently changed first. */
export function listDesigns(storage = browserStorage()): SavedDesign[] {
  return readAll(storage).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getDesign(id: string, storage = browserStorage()): SavedDesign | undefined {
  return readAll(storage).find((d) => d.id === id)
}

export interface SaveInput {
  /** Overwrite this design; omit to create a new one */
  id?: string | null
  name: string
  params: unknown
  thumbnail: string
}

/** Create or update a design. Returns it, or null if it couldn't be stored. */
export function saveDesign(input: SaveInput, storage = browserStorage(), now = Date.now()): SavedDesign | null {
  const all = readAll(storage)
  const existing = input.id ? all.find((d) => d.id === input.id) : undefined
  const design: SavedDesign = {
    id: existing?.id ?? newId(),
    name: input.name.trim() || 'Untitled vase',
    params: input.params,
    // Keep the old picture if a new one couldn't be captured
    thumbnail: input.thumbnail || existing?.thumbnail || '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: SCHEMA_VERSION,
  }
  const next = existing ? all.map((d) => (d.id === design.id ? design : d)) : [...all, design]
  return writeAll(storage, next) ? design : null
}

export function renameDesign(id: string, name: string, storage = browserStorage()): boolean {
  const all = readAll(storage)
  const trimmed = name.trim()
  if (!trimmed || !all.some((d) => d.id === id)) return false
  return writeAll(storage, all.map((d) => (d.id === id ? { ...d, name: trimmed } : d)))
}

export function duplicateDesign(id: string, storage = browserStorage(), now = Date.now()): SavedDesign | null {
  const original = readAll(storage).find((d) => d.id === id)
  if (!original) return null
  return saveDesign(
    { name: `${original.name} copy`, params: original.params, thumbnail: original.thumbnail },
    storage,
    now,
  )
}

export function deleteDesign(id: string, storage = browserStorage()): boolean {
  const all = readAll(storage)
  return writeAll(storage, all.filter((d) => d.id !== id))
}
