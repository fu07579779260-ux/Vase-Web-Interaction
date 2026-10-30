import { beforeEach, describe, expect, it } from 'vitest'
import { generateVaseMesh, exportResolution, stlBytes, triangleCount } from '@/geometry/vase-mesh'
import { useVaseStore } from '@/store/vase-store'
import { DEFAULT_PARAMS, QUALITY_PRESETS, matchingQualityPreset, type VaseParams } from './params'

const state = () => useVaseStore.getState()
const params = () => state().params

describe('quality presets in the store', () => {
  beforeEach(() => state().reset())

  it('defaults to Normal with its counts', () => {
    expect(params().qualityPreset).toBe('normal')
    expect(exportResolution(params())).toEqual(QUALITY_PRESETS.normal)
  })

  it('picking a preset loads its segment counts', () => {
    state().setParam('qualityPreset', 'fine')
    expect(exportResolution(params())).toEqual(QUALITY_PRESETS.fine)
  })

  it('moving a segment slider switches to Custom', () => {
    state().setParam('segmentsRadial', 300)
    expect(params().qualityPreset).toBe('custom')
    expect(params().segmentsRadial).toBe(300)
  })

  it('segment counts that match a preset select it again', () => {
    state().setParams({ segmentsVertical: 64, segmentsRadial: 64 })
    expect(params().qualityPreset).toBe('draft')
  })

  it('choosing Custom keeps the current counts', () => {
    state().setParam('qualityPreset', 'custom')
    expect(params().qualityPreset).toBe('custom')
    expect(exportResolution(params())).toEqual(QUALITY_PRESETS.normal)
  })

  it('loading a save keeps its stated preset', () => {
    state().loadParams({ ...DEFAULT_PARAMS, ...QUALITY_PRESETS.draft, qualityPreset: 'draft' })
    expect(params().qualityPreset).toBe('draft')
  })
})

describe('matchingQualityPreset', () => {
  it('finds presets and falls back to custom', () => {
    expect(matchingQualityPreset(QUALITY_PRESETS.fine)).toBe('fine')
    expect(matchingQualityPreset({ segmentsVertical: 1, segmentsRadial: 2 })).toBe('custom')
  })
})

describe('triangleCount', () => {
  const cases: [string, Partial<VaseParams>][] = [
    ['plain vase mode', {}],
    ['solid wall', { printMode: 'solidWall' }],
    ['star + ribs + rolled lip', { sectionShape: 'star', sides: 7, patternType: 'ribs', lipType: 'rolled' }],
    ['spiral, solid wall, draft', { patternType: 'spiral', printMode: 'solidWall', ...QUALITY_PRESETS.draft }],
  ]

  it.each(cases)('matches the real mesh: %s', (_, over) => {
    const p = { ...DEFAULT_PARAMS, ...over }
    const res = exportResolution(p)
    expect(triangleCount(p, res)).toBe(generateVaseMesh(p, res).indices.length / 3)
  })

  it('binary STL size is 84 + 50 bytes per triangle', () => {
    expect(stlBytes(0)).toBe(84)
    expect(stlBytes(1000)).toBe(50_084)
  })
})
