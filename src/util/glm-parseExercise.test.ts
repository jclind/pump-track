import { describe, it, expect } from 'vitest'
import { parseExercise } from './parseExercise'

describe('parseExercise', () => {
  it('parses name, weight, and setsxreps expansion', () => {
    const result = parseExercise('deadlifts 100 3x8')
    expect(result.name).toBe('deadlifts')
    expect(result.weights).toEqual([
      { weight: 100, sets: [8, 8, 8], comment: '' },
    ])
    expect(result.originalString).toBe('deadlifts 100 3x8')
  })

  it('parses a plain rep count as a single set', () => {
    const result = parseExercise('squats 225 5')
    expect(result.weights).toEqual([
      { weight: 225, sets: [5], comment: '' },
    ])
  })

  it('parses comma-separated sets and a trailing comment', () => {
    const result = parseExercise('curls 50 12, 10 slow')
    expect(result.weights).toEqual([
      { weight: 50, sets: [12, 10], comment: 'slow' },
    ])
  })

  it('splits multiple weight groups on /', () => {
    const result = parseExercise('bench 135 5, 8/225 3x5 slow')
    expect(result.name).toBe('bench')
    expect(result.weights).toEqual([
      { weight: 135, sets: [5, 8], comment: '' },
      { weight: 225, sets: [5, 5, 5], comment: 'slow' },
    ])
  })

  it('keeps the multi-word exercise name before the first digit', () => {
    const result = parseExercise('bench press 135 5')
    expect(result.name).toBe('bench press')
    expect(result.weights[0].weight).toBe(135)
  })

  it('reuses the persistent id when given and generates a fresh one otherwise', () => {
    expect(parseExercise('rows 100 5', 'my-id').id).toBe('my-id')

    const a = parseExercise('rows 100 5')
    const b = parseExercise('rows 100 5')
    expect(a.id).not.toBe(b.id)
    expect(a.id).toBeTruthy()
  })

  it('collects comments from separate comma segments', () => {
    const result = parseExercise('rows 100 5, 8 left arm, right arm')
    expect(result.weights).toEqual([
      { weight: 100, sets: [5, 8], comment: 'left arm, right arm' },
    ])
  })
})
