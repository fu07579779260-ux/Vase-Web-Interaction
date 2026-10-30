import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, NUMBER_PARAMS, clampParam, vaseParamsSchema } from './params'
import { useVaseStore } from '@/store/vase-store'

describe('parameter model', () => {
  it('defaults pass the schema', () => {
    expect(vaseParamsSchema.safeParse(DEFAULT_PARAMS).success).toBe(true)
  })

  it('every number default sits inside its range', () => {
    for (const [key, spec] of Object.entries(NUMBER_PARAMS)) {
      expect(spec.min, key).toBeLessThan(spec.max)
      expect(spec.default, key).toBeGreaterThanOrEqual(spec.min)
      expect(spec.default, key).toBeLessThanOrEqual(spec.max)
    }
  })

  it('clampParam keeps values in range and rejects NaN', () => {
    expect(clampParam('height', 9999)).toBe(400)
    expect(clampParam('height', -5)).toBe(20)
    expect(clampParam('height', 120)).toBe(120)
    expect(clampParam('height', Number.NaN)).toBe(150)
  })

  it('schema rejects out-of-range numbers and unknown enum values', () => {
    expect(vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, height: 1000 }).success).toBe(false)
    expect(vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, material: 'Wood' }).success).toBe(false)
    expect(vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, controlPoints: [] }).success).toBe(false)
  })
})

describe('vase store', () => {
  // A huge custom printer so only the parameter ranges limit values here
  beforeEach(() => {
    useVaseStore.getState().reset()
    useVaseStore.getState().setParams({ printerPreset: 'customFDM', buildX: 1000, buildY: 1000, buildZ: 1000 })
  })

  it('setParam clamps numbers', () => {
    useVaseStore.getState().setParam('height', 5000)
    expect(useVaseStore.getState().params.height).toBe(400)
  })

  it('setParams updates several values', () => {
    useVaseStore.getState().setParams({ bottomRadius: 60, material: 'PETG' })
    const { params } = useVaseStore.getState()
    expect(params.bottomRadius).toBe(60)
    expect(params.material).toBe('PETG')
  })

  it('loadParams fills missing fields with defaults', () => {
    expect(useVaseStore.getState().loadParams({ height: 200 })).toBe(true)
    const { params } = useVaseStore.getState()
    expect(params.height).toBe(200)
    expect(params.topRadius).toBe(DEFAULT_PARAMS.topRadius)
  })

  it('loadParams rejects invalid data and keeps current params', () => {
    useVaseStore.getState().setParam('height', 180)
    for (const bad of [null, 'hello', [1, 2], { height: 'tall' }, { height: 9999 }]) {
      expect(useVaseStore.getState().loadParams(bad)).toBe(false)
    }
    expect(useVaseStore.getState().params.height).toBe(180)
  })
})
