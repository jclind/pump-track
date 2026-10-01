import { describe, it, expect } from 'vitest'
import { getDataFromExercise } from './getDataFromExercise'
import { ExerciseDataType } from '../types'

const makeExercise = (
  originalString: string,
  name: string,
  weights: { weight: number; comment: string }[]
): ExerciseDataType =>
  ({
    id: 'id',
    name,
    originalString,
    weights: weights.map(w => ({ sets: [8], weight: w.weight, comment: w.comment })),
  }) as ExerciseDataType

describe('getDataFromExercise', () => {
  it('strips the exercise name and appends lbs to the weight', () => {
    const exercise = makeExercise(
      'deadlifts 100 3x8',
      'deadlifts',
      [{ weight: 100, comment: '' }]
    )
    expect(getDataFromExercise(exercise)).toBe('100lbs 3x8')
  })

  it('removes the comment from the display string', () => {
    const exercise = makeExercise(
      'deadlifts 100 3x8 felt good',
      'deadlifts',
      [{ weight: 100, comment: 'felt good' }]
    )
    expect(getDataFromExercise(exercise)).toBe('100lbs 3x8')
  })

  it('annotates every weight group and drops each group comment', () => {
    const exercise = makeExercise(
      'bench 135 5/225 3x5 slow',
      'bench',
      [
        { weight: 135, comment: '' },
        { weight: 225, comment: 'slow' },
      ]
    )
    expect(getDataFromExercise(exercise)).toBe('135lbs 5/225lbs 3x5')
  })

  // A weight equal to an earlier rep count must tag its own group.
  it('tags each group\'s own weight when numbers repeat across groups', () => {
    const exercise = makeExercise('curls 30 10/20 10/10 12', 'curls', [
      { weight: 30, comment: '' },
      { weight: 20, comment: '' },
      { weight: 10, comment: '' },
    ])
    expect(getDataFromExercise(exercise)).toBe('30lbs 10/20lbs 10/10lbs 12')
  })

  it('keeps the separators as typed', () => {
    const exercise = makeExercise('bench 135 5 / 225 3', 'bench', [
      { weight: 135, comment: '' },
      { weight: 225, comment: '' },
    ])
    expect(getDataFromExercise(exercise)).toBe('135lbs 5 / 225lbs 3')
  })
})
