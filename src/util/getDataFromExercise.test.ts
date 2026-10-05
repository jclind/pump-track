import { getDataFromExercise } from './getDataFromExercise'
import { parseExercise } from './parseExercise'

// The app stores exercise names in lowercase (see addExercises in tracker.ts).
const stored = (str: string) => {
  const exercise = parseExercise(str)
  return { ...exercise, name: exercise.name.toLowerCase() }
}

test('adds lbs to a weight typed without a unit', () => {
  expect(getDataFromExercise(stored('Bench 100 5,5,5'))).toBe('100lbs 5,5,5')
})

test('keeps a kg unit the user typed', () => {
  expect(getDataFromExercise(stored('Bench 100kg 5,5,5'))).toBe('100kg 5,5,5')
})

test('keeps a decimal lb unit the user typed', () => {
  expect(getDataFromExercise(stored('Curl 22.5lb 8,8'))).toBe('22.5lb 8,8')
})

test('handles one group with a unit and one without', () => {
  expect(getDataFromExercise(stored('Bench 100kg 5,5 / 105 3'))).toBe(
    '100kg 5,5 / 105lbs 3'
  )
})
