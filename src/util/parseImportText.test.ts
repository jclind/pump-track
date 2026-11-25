import { describe, it, expect } from 'vitest'
import { parseImportText } from './parseImportText'

describe('parseImportText', () => {
  it('splits workouts on blank lines and reads title, date, and exercises', () => {
    const { workouts, untitled } = parseImportText(
      'Push 3/15/2024\nbench 135 3x5\ndips 0 3x10\n\nPull 3/16/2024\nrows 100 3x8'
    )

    expect(untitled).toBe(0)
    expect(workouts).toHaveLength(2)
    expect(workouts[0].name).toBe('push')
    expect(workouts[0].date).toBe(new Date(2024, 2, 15).getTime())
    expect(workouts[0].exercises.map(ex => ex.name)).toEqual(['bench', 'dips'])
    expect(workouts[1].name).toBe('pull')
    expect(workouts[1].exercises).toHaveLength(1)
  })

  it('handles Windows line endings', () => {
    const { workouts } = parseImportText(
      'Push 3/15/2024\r\nbench 135 3x5\r\n\r\nPull 3/16/2024\r\nrows 100 3x8\r\n'
    )

    expect(workouts.map(w => w.name)).toEqual(['push', 'pull'])
    expect(workouts[0].exercises[0].originalString).toBe('bench 135 3x5')
  })

  it('skips blank chunks, whitespace-only lines, and blank exercise lines', () => {
    const { workouts } = parseImportText(
      '\n\n\nPush 3/15/2024\nbench 135 3x5\n   \n\n\n\nPull\nrows 100 3x8\n\n  \n'
    )

    expect(workouts.map(w => w.name)).toEqual(['push', 'pull'])
    expect(workouts[0].exercises).toHaveLength(1)
    expect(workouts[1].exercises).toHaveLength(1)
  })

  it('counts chunks with no title instead of importing them', () => {
    const { workouts, untitled } = parseImportText(
      '3/15/2024\nbench 135 3x5\n\nPull\nrows 100 3x8'
    )

    expect(untitled).toBe(1)
    expect(workouts.map(w => w.name)).toEqual(['pull'])
  })

  it('returns nothing for empty input', () => {
    expect(parseImportText('  \n \r\n')).toEqual({ workouts: [], untitled: 0 })
  })

  it('leaves the date null when none is given', () => {
    expect(parseImportText('Legs\nsquat 225 5').workouts[0].date).toBeNull()
  })
})
