import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDateToMMMDDYYYY,
  formatDateToString,
  getMonthDay,
} from './dateUtil'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

describe('getMonthDay', () => {
  it('formats a recent date as m/d without the year', () => {
    const input = daysAgo(20)
    expect(getMonthDay(input)).toBe(
      `${input.getMonth() + 1}/${input.getDate()}`
    )
  })

  it('includes the year once the date is more than 11 months back', () => {
    const input = daysAgo(400)
    expect(getMonthDay(input)).toBe(
      `${input.getMonth() + 1}/${input.getDate()}/${input.getFullYear()}`
    )
  })

  it('accepts a millisecond timestamp', () => {
    const input = daysAgo(20)
    expect(getMonthDay(input.getTime())).toBe(getMonthDay(input))
  })

  it('throws on an invalid date', () => {
    expect(() => getMonthDay(NaN)).toThrow('Invalid input date.')
  })
})

describe('formatDateToString', () => {
  it('labels today and yesterday', () => {
    expect(formatDateToString(Date.now())).toBe('Today')
    expect(formatDateToString(daysAgo(1).getTime())).toBe('Yesterday')
  })

  it('uses the weekday name for dates two to six days back', () => {
    const names = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]
    for (let i = 2; i <= 6; i++) {
      const input = daysAgo(i)
      expect(formatDateToString(input.getTime())).toBe(names[input.getDay()])
    }
  })

  it('falls back to m/d after six days', () => {
    const input = daysAgo(7)
    expect(formatDateToString(input.getTime())).toBe(
      `${input.getMonth() + 1}/${input.getDate()}`
    )
  })

  it('accepts a Date object as well as a timestamp', () => {
    const input = daysAgo(7)
    expect(formatDateToString(input)).toBe(formatDateToString(input.getTime()))
  })

  it('throws on an invalid date', () => {
    expect(() => formatDateToString(NaN)).toThrow('Invalid input date.')
  })
})

describe('formatDateToMMMDDYYYY', () => {
  it('formats as short month, two-digit day, four-digit year', () => {
    expect(formatDateToMMMDDYYYY(new Date(2024, 2, 9))).toBe('Mar 09, 2024')
    expect(formatDateToMMMDDYYYY(new Date(2026, 11, 25))).toBe('Dec 25, 2026')
  })
})

// Workout dates with a typed date are local midnight, so these pin the clock
// to the afternoon and pass midnight inputs.
describe('calendar-day boundaries', () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h)

  it('calls today\'s midnight "Today" in the afternoon', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(2026, 10, 1, 15))
    expect(formatDateToString(at(2026, 10, 1))).toBe('Today')
    expect(formatDateToString(at(2026, 9, 30))).toBe('Yesterday')
    expect(formatDateToString(at(2026, 9, 29))).toBe('Tuesday')
  })

  it('calls yesterday 23:00 "Yesterday" just after midnight', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(2026, 10, 1, 0) )
    expect(formatDateToString(at(2026, 9, 30, 23))).toBe('Yesterday')
  })

  it('shows the year for the same month last year', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(2026, 10, 1, 12))
    // Without the year this would read "10/1", today's date.
    expect(getMonthDay(at(2025, 10, 1))).toBe('10/1/2025')
    expect(getMonthDay(at(2025, 11, 1))).toBe('11/1')
    expect(getMonthDay(at(2025, 9, 30))).toBe('9/30/2025')
  })
})
