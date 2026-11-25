import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTitleAndDate } from './getTitleAndDate'

afterEach(() => {
  vi.useRealTimers()
})

describe('getTitleAndDate', () => {
  it('does not read a program name like 5/3/1 as a date', () => {
    expect(getTitleAndDate('5/3/1 day')).toEqual({
      title: '5/3/1 day',
      date: null,
    })
  })

  it('still finds a date after a program name', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 16))
    const { title, date } = getTitleAndDate('5/3/1 day 11/10')
    expect(title).toBe('5/3/1 day')
    expect(date).toBe(new Date(2026, 10, 10).getTime())
  })

  it('puts a yearless date well in the future in the previous year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 2, 9, 0))
    expect(getTitleAndDate('Legs 12/30').date).toBe(
      new Date(2026, 11, 30).getTime()
    )
  })

  it('keeps a yearless date a day or two ahead in the current year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0))
    expect(getTitleAndDate('Legs 11/18').date).toBe(
      new Date(2026, 10, 18).getTime()
    )
  })

  it('keeps an explicit future year as typed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 2))
    expect(getTitleAndDate('Legs 12/30/2027').date).toBe(
      new Date(2027, 11, 30).getTime()
    )
  })
})
