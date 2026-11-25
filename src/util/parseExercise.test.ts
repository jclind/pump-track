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

test('keeps a name that starts with a digit and letters', () => {
  const result = parseExercise('21s 30 3x7')

  expect(result.name).toBe('21s')
  expect(result.weights).toEqual([{ weight: 30, sets: [7, 7, 7], comment: '' }])
})

test('keeps a name that starts with a number followed by words', () => {
  const result = parseExercise('3 point row 50 3x10')

  expect(result.name).toBe('3 point row')
  expect(result.weights[0].weight).toBe(50)
  expect(result.weights[0].sets).toEqual([10, 10, 10])
})

test('keeps a digit-led name made of several words', () => {
  expect(parseExercise('21s bicep curl 30 3x7').name).toBe('21s bicep curl')
})

test('does not take a weight, unit, or sets token as the name', () => {
  expect(parseExercise('100kg 5,5').name).toBe('')
  expect(parseExercise('100 3x8').name).toBe('')
  expect(parseExercise('3x8 100').name).toBe('')
  expect(parseExercise('100 kg 5').name).toBe('')
  expect(parseExercise('').name).toBe('')
})

test('caps the number of sets so a typo cannot freeze the page', () => {
  const { weights } = parseExercise('bench 100 100000000x1')

  expect(weights[0].sets).toHaveLength(100)
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
