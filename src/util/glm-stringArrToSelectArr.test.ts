import { describe, it, expect } from 'vitest'
import { stringArrToSelectArr } from './stringArrToSelectArr'

describe('stringArrToSelectArr', () => {
  it('builds title-cased labels while keeping the original value', () => {
    expect(stringArrToSelectArr(['bench press', 'DEADLIFTS'])).toEqual([
      { label: 'Bench Press', value: 'bench press' },
      { label: 'Deadlifts', value: 'DEADLIFTS' },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(stringArrToSelectArr([])).toEqual([])
  })
})
