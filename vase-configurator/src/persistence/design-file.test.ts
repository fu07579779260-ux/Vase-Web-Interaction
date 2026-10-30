import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, SCHEMA_VERSION, type VaseParams } from '@/model/params'
import { useDesignStore } from '@/store/design-store'
import { useVaseStore } from '@/store/vase-store'
import { FORMAT, parseDesignFile, toDesignFile } from './design-file'

const custom: VaseParams = { ...DEFAULT_PARAMS, height: 190, sectionShape: 'star', sides: 7, twist: 45 }
const file = (over: Record<string, unknown>) =>
  JSON.stringify({ format: FORMAT, version: SCHEMA_VERSION, name: 'X', params: {}, ...over })

describe('toDesignFile', () => {
  it('writes format, version, name, timestamp and params as readable JSON', () => {
    const text = toDesignFile('  Spiral  ', custom, new Date('2026-10-30T06:30:00Z'))
    const data = JSON.parse(text)
    expect(data).toMatchObject({
      format: FORMAT,
      version: SCHEMA_VERSION,
      name: 'Spiral',
      exportedAt: '2026-10-30T06:30:00.000Z',
    })
    expect(data.params).toEqual(custom)
    expect(text).toContain('\n  "format"') // indented, so people can read and diff it
  })
})

describe('parseDesignFile', () => {
  it('round-trips a design exactly', () => {
    const r = parseDesignFile(toDesignFile('Spiral', custom))
    expect(r).toEqual({ ok: true, name: 'Spiral', params: custom })
  })

  it('fills parameters missing from older files with defaults', () => {
    const r = parseDesignFile(file({ params: { height: 120 } }))
    expect(r.ok && r.params).toEqual({ ...DEFAULT_PARAMS, height: 120 })
  })

  it('names a nameless design "Imported vase"', () => {
    const r = parseDesignFile(file({ name: '   ' }))
    expect(r.ok && r.name).toBe('Imported vase')
  })

  it.each([
    ['not JSON', '{oops', /not valid JSON/],
    ['someone else’s JSON', JSON.stringify({ hello: 'world' }), /not a Vase Configurator design/],
    ['an array', '[1,2]', /not a Vase Configurator design/],
    ['no version', JSON.stringify({ format: FORMAT, params: {} }), /no valid version/],
    ['a newer version', file({ version: SCHEMA_VERSION + 1 }), /newer version/],
    ['no params', file({ params: 'none' }), /no parameters/],
  ])('refuses %s', (_, text, message) => {
    const r = parseDesignFile(text)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(message)
  })

  it('says which values are invalid', () => {
    const r = parseDesignFile(file({ params: { height: 'tall', twist: 9999 } }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/height/)
      expect(r.error).toMatch(/twist/)
    }
  })
})

describe('importDesign', () => {
  beforeEach(() => useDesignStore.getState().newDesign())

  it('loads the parameters as a new, unsaved design', () => {
    const r = parseDesignFile(toDesignFile('From a friend', custom))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(useDesignStore.getState().importDesign(r.name, r.params)).toBe(true)
    expect(useVaseStore.getState().params.twist).toBe(45)
    expect(useDesignStore.getState()).toMatchObject({ id: null, name: 'From a friend', savedParams: null })
  })

  it('an oversized design still lands inside the printer (build volume is a hard limit)', () => {
    const big = { ...DEFAULT_PARAMS, height: 400, bottomRadius: 150, topRadius: 150 }
    const r = parseDesignFile(toDesignFile('Huge', big))
    if (!r.ok) throw new Error(r.error)
    useDesignStore.getState().importDesign(r.name, r.params)
    expect(useVaseStore.getState().params.height).toBeLessThanOrEqual(DEFAULT_PARAMS.buildZ)
  })
})
