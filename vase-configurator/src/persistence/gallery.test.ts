import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS, SCHEMA_VERSION } from '@/model/params'
import { UNTITLED, useDesignStore } from '@/store/design-store'
import { useVaseStore } from '@/store/vase-store'
import {
  deleteDesign,
  duplicateDesign,
  getDesign,
  listDesigns,
  renameDesign,
  saveDesign,
  type KeyValueStore,
} from './gallery'
import { autosaveSession, restoreSession } from './session'

/** In-memory stand-in for localStorage; `full` simulates a quota error. */
function memoryStorage(): KeyValueStore & { data: Map<string, string>; full: boolean } {
  const data = new Map<string, string>()
  return {
    data,
    full: false,
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      if (this.full) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
  }
}

describe('gallery storage', () => {
  let s: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    s = memoryStorage()
  })

  it('saves a new design with id, timestamps and schema version', () => {
    const d = saveDesign({ name: 'Tall one', params: { height: 200 }, thumbnail: 'data:x' }, s, 1000)!
    expect(d.id).toBeTruthy()
    expect(d).toMatchObject({ name: 'Tall one', createdAt: 1000, updatedAt: 1000, version: SCHEMA_VERSION })
    expect(getDesign(d.id, s)?.params).toEqual({ height: 200 })
  })

  it('updating keeps id and creation time, and the old thumbnail if no new one', () => {
    const d = saveDesign({ name: 'A', params: 1, thumbnail: 'data:old' }, s, 1000)!
    const u = saveDesign({ id: d.id, name: 'A2', params: 2, thumbnail: '' }, s, 2000)!
    expect(u).toMatchObject({ id: d.id, name: 'A2', createdAt: 1000, updatedAt: 2000, thumbnail: 'data:old' })
    expect(listDesigns(s)).toHaveLength(1)
  })

  it('lists newest first', () => {
    saveDesign({ name: 'old', params: 0, thumbnail: '' }, s, 1)
    saveDesign({ name: 'new', params: 0, thumbnail: '' }, s, 3)
    saveDesign({ name: 'mid', params: 0, thumbnail: '' }, s, 2)
    expect(listDesigns(s).map((d) => d.name)).toEqual(['new', 'mid', 'old'])
  })

  it('blank names become "Untitled vase"', () => {
    expect(saveDesign({ name: '   ', params: 0, thumbnail: '' }, s)!.name).toBe('Untitled vase')
  })

  it('renames, duplicates and deletes', () => {
    const d = saveDesign({ name: 'Bulb', params: { a: 1 }, thumbnail: 't' }, s, 1)!
    expect(renameDesign(d.id, '  Fat bulb ', s)).toBe(true)
    expect(getDesign(d.id, s)!.name).toBe('Fat bulb')
    expect(renameDesign(d.id, '   ', s)).toBe(false)

    const copy = duplicateDesign(d.id, s, 5)!
    expect(copy.id).not.toBe(d.id)
    expect(copy).toMatchObject({ name: 'Fat bulb copy', params: { a: 1 }, thumbnail: 't' })

    expect(deleteDesign(d.id, s)).toBe(true)
    expect(listDesigns(s).map((x) => x.id)).toEqual([copy.id])
  })

  it('survives damaged storage: skips bad entries, ignores junk', () => {
    const good = saveDesign({ name: 'ok', params: 0, thumbnail: '' }, s)!
    const list = JSON.parse(s.data.get('vase-configurator:designs')!)
    s.data.set('vase-configurator:designs', JSON.stringify([...list, { id: 5 }, 'nope', null]))
    expect(listDesigns(s).map((d) => d.id)).toEqual([good.id])
    s.data.set('vase-configurator:designs', '{not json')
    expect(listDesigns(s)).toEqual([])
  })

  it('reports failure when storage is full or missing', () => {
    s.full = true
    expect(saveDesign({ name: 'x', params: 0, thumbnail: '' }, s)).toBeNull()
    expect(saveDesign({ name: 'x', params: 0, thumbnail: '' }, null)).toBeNull()
    expect(listDesigns(null)).toEqual([])
  })
})

describe('design store', () => {
  let s: ReturnType<typeof memoryStorage>
  const vase = () => useVaseStore.getState()
  const design = () => useDesignStore.getState()
  const isDirty = () => vase().params !== design().savedParams || design().name !== design().savedName

  beforeEach(() => {
    s = memoryStorage()
    design().newDesign()
  })

  it('a new design is clean and untitled', () => {
    expect(design()).toMatchObject({ id: null, name: UNTITLED })
    expect(isDirty()).toBe(false)
  })

  it('changing a parameter or the name makes it dirty; saving cleans it', () => {
    vase().setParam('height', 120)
    expect(isDirty()).toBe(true)
    const saved = design().save(s)!
    expect(design().id).toBe(saved.id)
    expect(isDirty()).toBe(false)
    design().setName('Renamed')
    expect(isDirty()).toBe(true)
  })

  it('saving twice updates the same entry', () => {
    design().save(s)
    vase().setParam('height', 110)
    design().save(s)
    expect(listDesigns(s)).toHaveLength(1)
  })

  it('opening restores the parameters and name', () => {
    vase().setParam('height', 123)
    design().setName('Short')
    const { id } = design().save(s)!
    design().newDesign()
    expect(vase().params.height).toBe(DEFAULT_PARAMS.height)

    expect(design().open(id, s)).toBe(true)
    expect(vase().params.height).toBe(123)
    expect(design()).toMatchObject({ id, name: 'Short' })
    expect(isDirty()).toBe(false)
  })

  it('refuses to open a damaged design and leaves the current one alone', () => {
    const bad = saveDesign({ name: 'bad', params: { height: 'tall' }, thumbnail: '' }, s)!
    vase().setParam('height', 140)
    expect(design().open(bad.id, s)).toBe(false)
    expect(vase().params.height).toBe(140)
  })

  it('a failed save keeps the design dirty', () => {
    vase().setParam('height', 99)
    s.full = true
    expect(design().save(s)).toBeNull()
    expect(isDirty()).toBe(true)
  })
})

describe('session', () => {
  afterEach(() => vi.useRealTimers())

  it('restores parameters and the open design after a reload', () => {
    vi.useFakeTimers()
    const s = memoryStorage()
    useDesignStore.getState().newDesign()
    const stop = autosaveSession(s)
    useVaseStore.getState().setParam('height', 177)
    useDesignStore.getState().setName('Session vase')
    const { id } = useDesignStore.getState().save(s)!
    vi.advanceTimersByTime(1000)
    stop()

    // "Reload"
    useDesignStore.getState().newDesign()
    restoreSession(s)
    expect(useVaseStore.getState().params.height).toBe(177)
    expect(useDesignStore.getState()).toMatchObject({ id, name: 'Session vase' })
    // Matches what's saved, so it counts as clean
    expect(useVaseStore.getState().params).toBe(useDesignStore.getState().savedParams)
  })

  it('unsaved work comes back as unsaved', () => {
    vi.useFakeTimers()
    const s = memoryStorage()
    useDesignStore.getState().newDesign()
    const stop = autosaveSession(s)
    useVaseStore.getState().setParam('height', 166)
    vi.advanceTimersByTime(1000)
    stop()

    useDesignStore.getState().newDesign()
    restoreSession(s)
    expect(useVaseStore.getState().params.height).toBe(166)
    expect(useDesignStore.getState().id).toBeNull()
    expect(useDesignStore.getState().savedParams).toBeNull() // dirty
  })

  it('an untouched new design comes back clean (regression)', () => {
    vi.useFakeTimers()
    const s = memoryStorage()
    useDesignStore.getState().newDesign()
    const stop = autosaveSession(s)
    useDesignStore.getState().setName('Draft') // trigger a write, then undo it
    useDesignStore.getState().setName('Untitled vase')
    vi.advanceTimersByTime(1000)
    stop()

    restoreSession(s)
    expect(useVaseStore.getState().params).toBe(useDesignStore.getState().savedParams)
    expect(useDesignStore.getState().name).toBe(useDesignStore.getState().savedName)
  })

  it('ignores a damaged session', () => {
    const s = memoryStorage()
    s.data.set('vase-configurator:session', '{"params": {"height": "huge"}}')
    useDesignStore.getState().newDesign()
    restoreSession(s)
    expect(useVaseStore.getState().params.height).toBe(DEFAULT_PARAMS.height)
  })
})
