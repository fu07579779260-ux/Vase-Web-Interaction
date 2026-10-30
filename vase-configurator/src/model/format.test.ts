import { describe, expect, it } from 'vitest'
import { formatNumber, formatRange, formatValue, parseTyped } from './format'
import { NUMBER_PARAMS } from './params'

describe('formatValue / formatNumber', () => {
  it('shows units and step-based decimals', () => {
    expect(formatValue(40, NUMBER_PARAMS.bottomRadius)).toBe('40.0 mm')
    expect(formatValue(150, NUMBER_PARAMS.height)).toBe('150 mm')
    expect(formatValue(45, NUMBER_PARAMS.twist)).toBe('45°')
    expect(formatValue(1.479, NUMBER_PARAMS.bellyWidth)).toBe('1.48×')
    expect(formatValue(0.35, NUMBER_PARAMS.bellyPosition)).toBe('35%')
  })

  it('edit box shows just the number (percent for fractions)', () => {
    expect(formatNumber(40, NUMBER_PARAMS.bottomRadius)).toBe('40.0')
    expect(formatNumber(0.35, NUMBER_PARAMS.bellyPosition)).toBe('35')
  })

  it('describes the range', () => {
    expect(formatRange(NUMBER_PARAMS.height)).toBe('20 mm – 400 mm, steps of 1')
    expect(formatRange(NUMBER_PARAMS.bellyPosition)).toBe('10% – 70%, steps of 1%')
  })
})

describe('parseTyped', () => {
  it.each([
    ['120', 'mm', 120],
    ['120 mm', 'mm', 120],
    [' 42.5 ', 'mm', 42.5],
    ['42,5', 'mm', 42.5],
    ['-90°', 'deg', -90],
    ['.5', 'mm', 0.5],
    ['35', 'fraction', 0.35],
    ['35%', 'fraction', 0.35],
  ] as const)('%j (%s) → %d', (text, unit, expected) => {
    expect(parseTyped(text, unit)).toBeCloseTo(expected, 12)
  })

  it.each(['', 'abc', '1.2.3', '--4', '.'])('rejects %j', (text) => {
    expect(parseTyped(text, 'mm')).toBeNull()
  })
})
