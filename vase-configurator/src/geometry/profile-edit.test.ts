import { beforeEach, describe, expect, it } from 'vitest'
import { CONTROL_POINT_LIMITS } from '@/model/params'
import { useVaseStore } from '@/store/vase-store'
import { fitsPrinter, vaseSize } from './bounds'
import { presetControlPoints } from './profile'
import { MIN_GAP, addPoint, lerpPoints, movePoint, removePoint } from './profile-edit'

const bulb = presetControlPoints('bulb') // t: 0, 0.35 (belly), 0.8 (neck), 1

describe('movePoint', () => {
  it('moves an interior point and keeps its role', () => {
    const out = movePoint(bulb, 1, 0.4, 1.6)!
    expect(out[1]).toEqual({ t: 0.4, r: 1.6, role: 'belly' })
    expect(out.filter((_, i) => i !== 1)).toEqual(bulb.filter((_, i) => i !== 1))
  })

  it('cannot pass its neighbours', () => {
    expect(movePoint(bulb, 1, 0.95, 1)![1].t).toBeCloseTo(0.8 - MIN_GAP, 12)
    expect(movePoint(bulb, 1, -1, 1)![1].t).toBeCloseTo(MIN_GAP, 12)
  })

  it('keeps the radius multiplier within limits', () => {
    expect(movePoint(bulb, 2, 0.8, 99)![2].r).toBe(CONTROL_POINT_LIMITS.rMax)
    expect(movePoint(bulb, 2, 0.8, 0)![2].r).toBe(CONTROL_POINT_LIMITS.rMin)
  })

  it('refuses to move the end points (they follow the radius sliders)', () => {
    expect(movePoint(bulb, 0, 0.5, 1)).toBeNull()
    expect(movePoint(bulb, 3, 0.5, 1)).toBeNull()
  })
})

describe('addPoint', () => {
  it('inserts in height order and reports where', () => {
    const { points, index } = addPoint(bulb, 0.6, 1.2)!
    expect(index).toBe(2)
    expect(points.map((p) => p.t)).toEqual([0, 0.35, 0.6, 0.8, 1])
  })

  it('refuses points crowding a neighbour, outside the vase, or beyond the maximum', () => {
    expect(addPoint(bulb, 0.355, 1)).toBeNull()
    expect(addPoint(bulb, 0, 1)).toBeNull()
    expect(addPoint(bulb, 1.2, 1)).toBeNull()
    let pts = bulb
    for (const t of [0.1, 0.2, 0.5, 0.6]) pts = addPoint(pts, t, 1)!.points
    expect(pts).toHaveLength(CONTROL_POINT_LIMITS.maxPoints)
    expect(addPoint(pts, 0.9, 1)).toBeNull()
  })
})

describe('removePoint', () => {
  it('removes interior points down to the minimum', () => {
    const five = addPoint(bulb, 0.6, 1)!.points
    expect(removePoint(five, 2)).toEqual(bulb)
    expect(removePoint(bulb, 1)).toBeNull() // already at 4
  })

  it('never removes an end point', () => {
    const five = addPoint(bulb, 0.6, 1)!.points
    expect(removePoint(five, 0)).toBeNull()
    expect(removePoint(five, 4)).toBeNull()
  })
})

describe('lerpPoints', () => {
  it('blends heights and widths', () => {
    const target = movePoint(bulb, 1, 0.45, 2)!
    const half = lerpPoints(bulb, target, 0.5)
    expect(half[1].t).toBeCloseTo(0.4, 12)
    expect(half[1].r).toBeCloseTo((bulb[1].r + 2) / 2, 12)
  })
})

describe('editing through the store', () => {
  const state = () => useVaseStore.getState()
  beforeEach(() => state().reset())

  it('a dragged point updates the zone sliders', () => {
    state().setParam('controlPoints', movePoint(state().params.controlPoints, 1, 0.3, 1.7)!)
    expect(state().params.bellyPosition).toBeCloseTo(0.3, 12)
    expect(state().params.bellyWidth).toBeCloseTo(1.7, 12)
  })

  it('removing the belly point hands its role to another point', () => {
    const five = addPoint(state().params.controlPoints, 0.6, 1.1)!.points
    state().setParam('controlPoints', five)
    const bellyIndex = state().params.controlPoints.findIndex((p) => p.role === 'belly')
    state().setParam('controlPoints', removePoint(state().params.controlPoints, bellyIndex)!)
    const roles = state().params.controlPoints.map((p) => p.role).filter(Boolean)
    expect(roles.sort()).toEqual(['belly', 'neck'])
  })

  it('dragging a point outward stops at the printer limit instead of shrinking the vase', () => {
    state().applyPrinterPreset('anycubicM7') // 126 mm short side
    const before = state().params
    state().setParam('controlPoints', movePoint(before.controlPoints, 1, 0.35, CONTROL_POINT_LIMITS.rMax)!)
    const after = state().params
    expect(fitsPrinter(after)).toBe(true)
    expect(after.bottomRadius).toBe(before.bottomRadius) // not rescaled
    expect(vaseSize(after).diameter).toBeGreaterThan(125)
  })

  it('adding a point that would overflow is refused', () => {
    state().applyPrinterPreset('anycubicM7')
    const before = state().params
    const added = addPoint(before.controlPoints, 0.6, CONTROL_POINT_LIMITS.rMax)!
    state().setParam('controlPoints', added.points)
    expect(state().params.controlPoints).toEqual(before.controlPoints)
  })
})
