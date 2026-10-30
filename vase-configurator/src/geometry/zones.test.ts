import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import {
  PROFILE_PRESETS,
  ZONE_LIMITS,
  assignRoles,
  presetControlPoints,
  setZone,
  zoneValues,
} from './profile'

const state = () => useVaseStore.getState()
const roleOf = (role: 'belly' | 'neck') => state().params.controlPoints.find((p) => p.role === role)!

describe('preset roles', () => {
  it.each([
    ['cylinder', 0.33, 0.67],
    ['bulb', 0.35, 0.8],
    ['hourglass', 0.25, 0.5],
    ['cone', 0.33, 0.67],
    ['bottle', 0.45, 0.85],
  ] as const)('%s: belly at %s, neck at %s', (preset, bellyT, neckT) => {
    const points = presetControlPoints(preset)
    expect(points.filter((p) => p.role === 'belly').map((p) => p.t)).toEqual([bellyT])
    expect(points.filter((p) => p.role === 'neck').map((p) => p.t)).toEqual([neckT])
  })

  it.each(PROFILE_PRESETS)('%s: zone values sit inside the slider ranges unclamped', (preset) => {
    const points = presetControlPoints(preset)
    const belly = points.find((p) => p.role === 'belly')!
    const neck = points.find((p) => p.role === 'neck')!
    const z = zoneValues(points)
    expect(z.bellyPosition).toBe(belly.t)
    expect(z.bellyWidth).toBeCloseTo(belly.r, 10)
    expect(z.neckPosition).toBe(neck.t)
    expect(z.neckWidth).toBeCloseTo(neck.r, 10)
  })
})

describe('assignRoles', () => {
  it('keeps valid existing roles even when widths cross', () => {
    const points = [
      { t: 0, r: 1 },
      { t: 0.3, r: 0.5, role: 'belly' as const }, // narrower than the neck — still the belly
      { t: 0.7, r: 1.2, role: 'neck' as const },
      { t: 1, r: 1 },
    ]
    expect(assignRoles(points)).toBe(points)
  })

  it('assigns roles to role-less imported points', () => {
    const out = assignRoles([
      { t: 0, r: 1 },
      { t: 0.4, r: 1.5 },
      { t: 0.6, r: 1.1 },
      { t: 0.85, r: 0.6 },
      { t: 1, r: 1 },
    ])
    expect(out.find((p) => p.role === 'belly')!.t).toBe(0.4)
    expect(out.find((p) => p.role === 'neck')!.t).toBe(0.85)
  })
})

describe('setZone', () => {
  const bulb = presetControlPoints('bulb')

  it('moves the belly width and leaves other points alone', () => {
    const out = setZone(bulb, 'bellyWidth', 1.8)
    expect(out.find((p) => p.role === 'belly')!.r).toBe(1.8)
    expect(out.filter((p) => p.role !== 'belly')).toEqual(bulb.filter((p) => p.role !== 'belly'))
  })

  it('stops the belly before it reaches the neck', () => {
    // Bottle: belly 0.45, next point 0.7 → belly can go no higher than 0.68
    const out = setZone(presetControlPoints('bottle'), 'bellyPosition', 0.7)
    expect(out.find((p) => p.role === 'belly')!.t).toBeCloseTo(0.68, 10)
  })

  it('clamps to the slider range', () => {
    const out = setZone(bulb, 'neckWidth', 5)
    expect(out.find((p) => p.role === 'neck')!.r).toBe(ZONE_LIMITS.neckWidth.max)
  })
})

describe('store zone sliders', () => {
  beforeEach(() => state().reset())

  it('defaults mirror the bulb points', () => {
    expect(DEFAULT_PARAMS.bellyPosition).toBe(0.35)
    expect(DEFAULT_PARAMS.bellyWidth).toBeCloseTo(roleOf('belly').r, 10)
  })

  it('setParam on a zone key moves the control point', () => {
    state().setParam('neckPosition', 0.9)
    expect(roleOf('neck').t).toBe(0.9)
    expect(state().params.neckPosition).toBe(0.9)
  })

  it('reports the clamped value when a point hits its neighbour', () => {
    state().applyProfilePreset('bottle')
    state().setParam('bellyPosition', 0.7)
    expect(state().params.bellyPosition).toBeCloseTo(0.68, 10)
  })

  it('switching preset updates the zone sliders', () => {
    state().applyProfilePreset('hourglass')
    expect(state().params.bellyPosition).toBe(0.25)
    expect(state().params.neckPosition).toBe(0.5)
    expect(state().params.neckWidth).toBeCloseTo(0.6, 10)
  })

  it('loaded points win over stale zone values', () => {
    const ok = state().loadParams({
      ...DEFAULT_PARAMS,
      bellyWidth: 0.9, // stale
      controlPoints: presetControlPoints('bottle'),
    })
    expect(ok).toBe(true)
    expect(state().params.bellyWidth).toBeCloseTo(roleOf('belly').r, 10)
  })
})
