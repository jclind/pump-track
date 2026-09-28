import { describe, it, expect } from 'vitest'
import { calculateInputWidth } from './calculateInputWidth'

// jsdom reports offsetWidth 0 for the measuring span, so the width comes
// from the padding alone; that still exercises the 1.1 multiplier cutoff.
describe('calculateInputWidth', () => {
  it('returns at least the padding for short text', () => {
    expect(calculateInputWidth('ben', 'Arial', 50)).toBe(50)
  })

  it('widens inputs that reach 100px by another 10 percent', () => {
    expect(calculateInputWidth('bench press', 'Arial', 100)).toBeCloseTo(110)
    expect(calculateInputWidth('bench press', 'Arial', 99)).toBe(99)
  })

  it('cleans the measuring span out of the document', () => {
    calculateInputWidth('ben', 'Arial', 10)
    expect(document.querySelectorAll('span')).toHaveLength(0)
  })
})
