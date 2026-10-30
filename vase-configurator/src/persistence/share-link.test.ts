import LZString from 'lz-string'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS, SCHEMA_VERSION, type VaseParams } from '@/model/params'
import { presetControlPoints } from '@/geometry/profile'
import { useDesignStore } from '@/store/design-store'
import { useNoticeStore } from '@/store/notice-store'
import { useVaseStore } from '@/store/vase-store'
import { openSharedLink } from './open-shared'
import { changedParams, decodeShareHash, encodeShareHash, isShareHash, shareUrl } from './share-link'

const custom: VaseParams = {
  ...DEFAULT_PARAMS,
  height: 190,
  sectionShape: 'star',
  sides: 7,
  twist: 45,
  patternType: 'spiral',
  lipType: 'rolled',
  materialColor: '#aa3355',
}

describe('encode / decode', () => {
  it('round-trips a design exactly, including its name', () => {
    expect(decodeShareHash(encodeShareHash('Spiral star', custom))).toEqual({
      ok: true,
      name: 'Spiral star',
      params: custom,
    })
  })

  it('works with or without the leading #', () => {
    const hash = encodeShareHash('x', custom)
    expect(decodeShareHash(`#${hash}`)).toEqual(decodeShareHash(hash))
    expect(isShareHash(`#${hash}`)).toBe(true)
    expect(isShareHash('#section-2')).toBe(false)
  })

  it('only stores parameters that differ from the defaults', () => {
    expect(changedParams(DEFAULT_PARAMS)).toEqual({})
    expect(Object.keys(changedParams({ ...DEFAULT_PARAMS, twist: 10 }))).toEqual(['twist'])
  })

  it('keeps links short', () => {
    expect(encodeShareHash('Untitled vase', DEFAULT_PARAMS).length).toBeLessThan(80)
    const busy = { ...custom, controlPoints: presetControlPoints('bottle') }
    expect(encodeShareHash('Spiral star', busy).length).toBeLessThan(400)
  })

  it('builds a full URL on the current page', () => {
    const url = shareUrl('x', custom, 'https://example.test/app/?a=1#old')
    expect(url.startsWith('https://example.test/app/?a=1#d=')).toBe(true)
  })

  it('refuses damaged, cut-off and newer links with a reason', () => {
    const good = encodeShareHash('x', custom)
    for (const bad of ['d=!!!', good.slice(0, good.length / 2), '#nothing']) {
      const r = decodeShareHash(bad)
      expect(r.ok).toBe(false)
    }
    const newer = 'd=' + LZString.compressToEncodedURIComponent(JSON.stringify({ v: SCHEMA_VERSION + 1, n: 'x', p: {} }))
    const r = decodeShareHash(newer)
    expect(r.ok === false && r.error).toMatch(/newer version/)
  })

  it('refuses out-of-range values smuggled into a link', () => {
    const evil = 'd=' + LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, n: 'x', p: { height: 99999 } }))
    expect(decodeShareHash(evil).ok).toBe(false)
  })
})

describe('openSharedLink', () => {
  const loc = (hash: string) => ({ hash, pathname: '/', search: '' })

  beforeEach(() => {
    useDesignStore.getState().newDesign()
    useNoticeStore.getState().dismiss()
  })

  it('opens the design as new and unsaved, and clears the hash', () => {
    const clear = vi.fn()
    const opened = openSharedLink(loc(`#${encodeShareHash('From a link', custom)}`), () => true, clear)
    expect(opened).toBe(true)
    expect(clear).toHaveBeenCalledOnce()
    expect(useVaseStore.getState().params.twist).toBe(45)
    expect(useDesignStore.getState()).toMatchObject({ id: null, name: 'From a link', savedParams: null })
  })

  it('does nothing for an ordinary hash', () => {
    const clear = vi.fn()
    expect(openSharedLink(loc('#top'), () => true, clear)).toBe(false)
    expect(clear).not.toHaveBeenCalled()
  })

  it('asks before replacing unsaved work, and respects "no"', () => {
    useVaseStore.getState().setParam('height', 111)
    const ask = vi.fn(() => false)
    expect(openSharedLink(loc(`#${encodeShareHash('x', custom)}`), ask, () => {})).toBe(false)
    expect(ask).toHaveBeenCalledOnce()
    expect(useVaseStore.getState().params.height).toBe(111)
  })

  it('does not ask when there is nothing unsaved', () => {
    const ask = vi.fn(() => false)
    openSharedLink(loc(`#${encodeShareHash('x', custom)}`), ask, () => {})
    expect(ask).not.toHaveBeenCalled()
  })

  it('shows a notice for a broken link and keeps the current design', () => {
    openSharedLink(loc('#d=garbage'), () => true, () => {})
    expect(useNoticeStore.getState().message).toMatch(/Couldn’t open the shared design/)
    expect(useVaseStore.getState().params).toEqual(DEFAULT_PARAMS)
  })
})
