import { describe, it, expect } from 'vitest'
import { calculateMaxWeight } from './calculateMaxWeight'
import { WeightGroupType } from '../types'

const group = (weight: number): WeightGroupType => ({
  weight,
  sets: [5],
  comment: '',
})

describe('calculateMaxWeight', () => {
  it('returns the largest weight across groups', () => {
    expect(calculateMaxWeight([group(10), group(45), group(25)])).toBe(45)
  })

  it('finds the maximum regardless of order', () => {
    expect(calculateMaxWeight([group(100), group(45)])).toBe(100)
    expect(calculateMaxWeight([group(45), group(100)])).toBe(100)
  })

  it('returns 0 for an empty list', () => {
    expect(calculateMaxWeight([])).toBe(0)
  })

  it('handles a single group', () => {
    expect(calculateMaxWeight([group(225)])).toBe(225)
  })
})
