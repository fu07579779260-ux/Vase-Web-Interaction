import { beforeEach, describe, expect, it } from 'vitest'
import { useVaseStore } from '@/store/vase-store'
import { MATERIALS, materialPatch } from './materials'
import { DEFAULT_PARAMS, ENUM_PARAMS, vaseParamsSchema } from './params'

const state = () => useVaseStore.getState()

describe('material table', () => {
  it.each(ENUM_PARAMS.material)('%s has a valid default colour and sane rules', (m) => {
    const spec = MATERIALS[m]
    expect(vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...materialPatch(m) }).success).toBe(true)
    expect(spec.maxOverhang).toBeGreaterThan(0)
    expect(spec.maxOverhang).toBeLessThanOrEqual(45)
    expect(spec.minWall(0.4)).toBeGreaterThan(0)
  })

  it('applies the PLAN min-wall rules', () => {
    expect(MATERIALS.PLA.minWall(0.4)).toBeCloseTo(0.8, 12)
    expect(MATERIALS.PETG.minWall(0.6)).toBeCloseTo(1.2, 12)
    expect(MATERIALS.TPU.minWall(0.4)).toBeCloseTo(1.2, 12)
    expect(MATERIALS.Resin.minWall(0.4)).toBe(0.8)
  })

  it('default params use PLA with its default colour', () => {
    expect(DEFAULT_PARAMS.material).toBe('PLA')
    expect(DEFAULT_PARAMS.materialColor).toBe(MATERIALS.PLA.defaultColor)
  })
})

describe('material in the store', () => {
  beforeEach(() => state().reset())

  it('applyMaterial switches material and resets the colour', () => {
    state().setParam('materialColor', '#ff0000')
    state().applyMaterial('PETG')
    expect(state().params.material).toBe('PETG')
    expect(state().params.materialColor).toBe(MATERIALS.PETG.defaultColor)
  })

  it('a resin printer switches FDM material to resin', () => {
    state().applyMaterial('TPU')
    state().applyPrinterPreset('elegooSaturn4')
    expect(state().params.material).toBe('Resin')
  })

  it('an FDM printer switches resin to PLA', () => {
    state().applyPrinterPreset('anycubicM7')
    state().applyPrinterPreset('prusaMK4')
    expect(state().params.material).toBe('PLA')
  })

  it('a material that fits the new printer is kept, colour included', () => {
    state().applyMaterial('PETG')
    state().setParam('materialColor', '#123456')
    state().applyPrinterPreset('enderV3')
    expect(state().params.material).toBe('PETG')
    expect(state().params.materialColor).toBe('#123456')
  })
})
