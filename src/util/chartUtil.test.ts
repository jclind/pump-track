import { getEndOfDay } from './chartUtil'

describe('getEndOfDay', () => {
  test('returns the end of the same local day for a midnight timestamp', () => {
    const timestamp = new Date(2026, 9, 5, 0, 0).getTime()

    expect(getEndOfDay(timestamp)).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999))
  })

  test('returns the end of the same local day for a 15:30 timestamp', () => {
    const timestamp = new Date(2026, 9, 5, 15, 30).getTime()

    expect(getEndOfDay(timestamp)).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999))
  })

  test('does not mutate the input', () => {
    const input = new Date(2026, 9, 5, 15, 30)
    const timestamp = input.getTime()

    getEndOfDay(timestamp)

    expect(timestamp).toBe(new Date(2026, 9, 5, 15, 30).getTime())
    expect(input.getTime()).toBe(timestamp)
  })

  test('returns a time later than noon on the same day', () => {
    const timestamp = new Date(2026, 9, 5, 12, 0).getTime()

    expect(getEndOfDay(timestamp).getTime()).toBeGreaterThan(timestamp)
  })
})
