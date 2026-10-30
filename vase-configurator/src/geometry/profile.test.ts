import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, vaseParamsSchema } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import {
  PRESET_SHAPES,
  PROFILE_PRESETS,
  monotoneCubic,
  normalizeControlPoints,
  presetControlPoints,
} from './profile'
import { radiusFunction } from './vase-mesh'

describe('monotoneCubic', () => {
  const xs = [0, 0.3, 0.6, 1]
  const ys = [1, 1.5, 0.5, 0.8]
  const f = monotoneCubic(xs, ys)

  it('passes through every point', () => {
    xs.forEach((x, i) => expect(f(x)).toBeCloseTo(ys[i], 10))
  })

  it('never overshoots between neighbouring points', () => {
    for (let k = 0; k < xs.length - 1; k++) {
      const lo = Math.min(ys[k], ys[k + 1])
      const hi = Math.max(ys[k], ys[k + 1])
      for (let i = 0; i <= 50; i++) {
        const y = f(xs[k] + ((xs[k + 1] - xs[k]) * i) / 50)
        expect(y).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(y).toBeLessThanOrEqual(hi + 1e-9)
      }
    }
  })

  it('clamps outside the range', () => {
    expect(f(-1)).toBe(1)
    expect(f(2)).toBe(0.8)
  })
})

describe('profile presets', () => {
  it.each(PROFILE_PRESETS)('%s produces valid, pinned control points', (preset) => {
    const points = presetControlPoints(preset)
    expect(points[0]).toEqual({ t: 0, r: 1 })
    const last = points[points.length - 1]
    expect(last.t).toBe(1)
    expect(last.r).toBeCloseTo(1, 10)
    expect(vaseParamsSchema.shape.controlPoints.safeParse(points).success).toBe(true)
  })

  it.each(PROFILE_PRESETS)('%s silhouette matches the preset shape in mm', (preset) => {
    const bottomRadius = 40
    const { topRatio, shape } = PRESET_SHAPES[preset]
    const radiusAt = radiusFunction({
      ...DEFAULT_PARAMS,
      bottomRadius,
      topRadius: bottomRadius * topRatio,
      controlPoints: presetControlPoints(preset),
    })
    for (const [t, f] of shape) expect(radiusAt(t)).toBeCloseTo(bottomRadius * f, 6)
  })

  it('end radii equal the bottom/top radius sliders', () => {
    const radiusAt = radiusFunction({ ...DEFAULT_PARAMS, bottomRadius: 55, topRadius: 22 })
    expect(radiusAt(0)).toBeCloseTo(55, 10)
    expect(radiusAt(1)).toBeCloseTo(22, 10)
  })

  it('default params use the bulb preset', () => {
    expect(DEFAULT_PARAMS.profilePreset).toBe('bulb')
    expect(DEFAULT_PARAMS.controlPoints).toEqual(presetControlPoints('bulb'))
    expect(DEFAULT_PARAMS.topRadius).toBe(DEFAULT_PARAMS.bottomRadius * PRESET_SHAPES.bulb.topRatio)
  })
})

describe('normalizeControlPoints', () => {
  it('sorts by height and pins the end points', () => {
    const out = normalizeControlPoints([
      { t: 0.9, r: 0.5 },
      { t: 0.1, r: 2 },
      { t: 0.5, r: 1.2 },
      { t: 0.4, r: 0.9 },
    ])
    expect(out.map((p) => p.t)).toEqual([0, 0.4, 0.5, 1])
    expect(out[0].r).toBe(1)
    expect(out[3].r).toBe(1)
  })
})

describe('applyProfilePreset', () => {
  beforeEach(() => useVaseStore.getState().reset())

  it('sets control points and top radius from the ratio', () => {
    useVaseStore.getState().setParam('bottomRadius', 50)
    useVaseStore.getState().applyProfilePreset('bottle')
    const { params } = useVaseStore.getState()
    expect(params.profilePreset).toBe('bottle')
    expect(params.topRadius).toBe(20)
    expect(params.controlPoints).toEqual(presetControlPoints('bottle'))
  })

  it('clamps the top radius to its range', () => {
    // Huge custom printer so only the parameter range limits the radius
    useVaseStore.getState().setParams({ printerPreset: 'customFDM', buildX: 1000, buildY: 1000, buildZ: 1000 })
    useVaseStore.getState().setParam('bottomRadius', 150)
    useVaseStore.getState().applyProfilePreset('cone') // 150 × 1.8 = 270 > 150
    expect(useVaseStore.getState().params.topRadius).toBe(150)
  })
})
