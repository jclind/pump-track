import { errorMessage } from './errorMessage'

test('returns the message of an Error', () => {
  expect(errorMessage(new Error('Quota exceeded'))).toBe('Quota exceeded')
})

test('returns a string error as is', () => {
  expect(errorMessage('offline')).toBe('offline')
})

test('falls back to a fixed string for anything else', () => {
  expect(errorMessage(undefined)).toBe('Something went wrong')
  expect(errorMessage(null)).toBe('Something went wrong')
  expect(errorMessage({ code: 'x' })).toBe('Something went wrong')
  expect(errorMessage(new Error(''))).toBe('Something went wrong')
})
