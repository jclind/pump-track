import { parseExercise } from './parseExercise'

test('parses a weight with kg units', () => {
  const { weights } = parseExercise('Bench 100kg 5,5,5')

  expect(weights[0].weight).toBe(100)
  expect(weights[0].sets).toEqual([5, 5, 5])
  expect(weights[0].comment).toBe('')
  weights.forEach(({ weight }) => expect(Number.isNaN(weight)).toBe(false))
})

test('parses a weight without units', () => {
  const { weights } = parseExercise('Bench 100 5,5,5')

  expect(weights[0].weight).toBe(100)
  expect(weights[0].sets).toEqual([5, 5, 5])
  expect(weights[0].comment).toBe('')
  weights.forEach(({ weight }) => expect(Number.isNaN(weight)).toBe(false))
})

test('parses a decimal weight with lb units', () => {
  const { weights } = parseExercise('Curl 22.5lb 8,8')

  expect(weights[0].weight).toBe(22.5)
  expect(weights[0].sets).toEqual([8, 8])
  expect(weights[0].comment).toBe('')
  weights.forEach(({ weight }) => expect(Number.isNaN(weight)).toBe(false))
})

test('parses two weight groups with kg units', () => {
  const { weights } = parseExercise('Bench 100kg 5,5 / 105kg 3')

  expect(weights).toHaveLength(2)
  expect(weights[0].weight).toBe(100)
  expect(weights[1].weight).toBe(105)
  expect(weights[0].comment).toBe('')
  expect(weights[1].comment).toBe('')
  weights.forEach(({ weight }) => expect(Number.isNaN(weight)).toBe(false))
})
