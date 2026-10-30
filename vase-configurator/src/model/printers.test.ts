import { beforeEach, describe, expect, it } from 'vitest'
import { fitsPrinter, maxRadius, vaseSize } from '@/geometry/bounds'
import { useVaseStore } from '@/store/vase-store'
import { DEFAULT_PARAMS, ENUM_PARAMS, vaseParamsSchema } from './params'
import { PRINTERS, printerPatch } from './printers'

const state = () => useVaseStore.getState()
const params = () => state().params

describe('printer presets', () => {
  it.each(ENUM_PARAMS.printerPreset)('%s produces valid parameters', (preset) => {
    const result = vaseParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...printerPatch(preset) })
    expect(result.success).toBe(true)
  })

  it('matches the checked spec sheets', () => {
    expect(PRINTERS.prusaMK4.build).toEqual({ x: 250, y: 210, z: 220 })
    expect(PRINTERS.elegooSaturn4.build).toEqual({ x: 218.88, y: 122.88, z: 220 })
    expect(PRINTERS.anycubicM7.build).toEqual({ x: 223, y: 126, z: 230 })
  })

  it('custom entries keep the current numbers', () => {
    expect(printerPatch('customResin')).toEqual({ printerPreset: 'customResin' })
  })
})

describe('bounds', () => {
  it('default vase fits the default printer', () => {
    expect(fitsPrinter(DEFAULT_PARAMS)).toBe(true)
  })

  it('a pattern adds its amplitude to the radius', () => {
    const plain = maxRadius(DEFAULT_PARAMS)
    expect(maxRadius({ ...DEFAULT_PARAMS, patternType: 'ribs', patternAmplitude: 3 })).toBeCloseTo(plain + 3, 10)
  })
})

describe('build-volume limit in the store', () => {
  beforeEach(() => state().reset())

  it('height slider stops at the printer height', () => {
    state().setParam('height', 400)
    expect(params().height).toBe(256)
  })

  it('radius slider stops when the vase fills the short side of the bed', () => {
    state().applyPrinterPreset('anycubicM7') // bed 223 × 126
    state().setParam('bottomRadius', 150)
    expect(fitsPrinter(params())).toBe(true)
    // Snapping to the 0.5 mm radius step may leave up to one step (× belly width) of slack
    expect(vaseSize(params()).diameter).toBeGreaterThan(124)
  })

  it('zone sliders are limited too', () => {
    state().applyPrinterPreset('elegooSaturn4')
    state().setParam('bottomRadius', 50)
    state().setParam('bellyWidth', 2)
    expect(fitsPrinter(params())).toBe(true)
    expect(params().bellyWidth).toBeLessThan(2)
  })

  it('switching to a smaller printer shrinks the vase and keeps its proportions', () => {
    state().setParams({ height: 250, bottomRadius: 70 })
    const ratio = params().topRadius / params().bottomRadius
    state().applyPrinterPreset('anycubicM7')
    expect(fitsPrinter(params())).toBe(true)
    expect(params().height).toBe(230)
    expect(params().topRadius / params().bottomRadius).toBeCloseTo(ratio, 6)
  })

  it('shrinking a custom bed rescales the vase instead of blocking the printer slider', () => {
    state().applyPrinterPreset('customFDM')
    expect(params().buildX).toBe(256) // kept from the previous preset
    state().setParam('buildX', 80)
    expect(params().buildX).toBe(80)
    expect(vaseSize(params()).diameter).toBeLessThanOrEqual(80 + 1e-6)
  })

  it('loading an oversized design scales it to fit', () => {
    const ok = state().loadParams({ ...DEFAULT_PARAMS, height: 300, bottomRadius: 140, topRadius: 140 })
    expect(ok).toBe(true)
    expect(fitsPrinter(params())).toBe(true)
  })

  it('profile presets that would overflow are scaled to fit', () => {
    state().applyPrinterPreset('anycubicM7')
    state().setParam('bottomRadius', 60)
    state().applyProfilePreset('cone') // top = 1.8 × bottom
    expect(fitsPrinter(params())).toBe(true)
  })
})
