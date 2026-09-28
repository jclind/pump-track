import { describe, it, expect } from 'vitest'
import { getTitleAndDate } from './getTitleAndDate'

describe('getTitleAndDate', () => {
  it('extracts a full m/d/yyyy date and lowercases the title', () => {
    const { title, date } = getTitleAndDate('Leg Day 3/15/2024')
    expect(title).toBe('leg day')
    expect(date).toBe(new Date('3/15/2024').getTime())
  })

  it('appends the current year to a short m/d date', () => {
    const { title, date } = getTitleAndDate('Push 3/15')
    expect(title).toBe('push')
    const currYear = new Date().getFullYear()
    expect(date).toBe(new Date(`3/15/${currYear}`).getTime())
  })

  it('returns a null date when the string has no date', () => {
    const { title, date } = getTitleAndDate('  Upper Body  ')
    expect(title).toBe('upper body')
    expect(date).toBeNull()
  })

  it('matches the first date when the string holds several', () => {
    const { title, date } = getTitleAndDate('12/25/2023 stuff 5/2')
    expect(title).toBe('stuff 5/2')
    expect(date).toBe(new Date('12/25/2023').getTime())
  })
})
