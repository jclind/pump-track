import { describe, it, expect } from 'vitest'
import {
  convertToTimeNumber,
  formatChartData,
  getChartTimeUnit,
  getStartOfDayArrayByPeriod,
  getStepSize,
  roundToNearestMultipleOf5,
} from './chartUtil'
import { ExercisesServerDataType } from '../types'

const MIN = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

describe('convertToTimeNumber', () => {
  it('returns 0 for allTime', () => {
    expect(convertToTimeNumber('allTime')).toBe(0)
  })

  it('returns a timestamp one week ago for week', () => {
    const before = Date.now() - 7 * DAY
    const result = convertToTimeNumber('week')
    const after = Date.now() - 7 * DAY
    expect(result).toBeGreaterThanOrEqual(before - MIN)
    expect(result).toBeLessThanOrEqual(after + MIN)
  })

  it('returns a timestamp about one month ago for month', () => {
    const result = convertToTimeNumber('month')
    expect(result).toBeLessThanOrEqual(Date.now() - 27 * DAY)
    expect(result).toBeGreaterThanOrEqual(Date.now() - 32 * DAY)
  })

  it('returns a timestamp about one year ago for year', () => {
    const result = convertToTimeNumber('year')
    expect(result).toBeLessThanOrEqual(Date.now() - 364 * DAY)
    expect(result).toBeGreaterThanOrEqual(Date.now() - 367 * DAY)
  })

  it('throws on an unknown period', () => {
    expect(() => convertToTimeNumber('day' as any)).toThrow(
      'Invalid time period'
    )
  })
})

describe('getStartOfDayArrayByPeriod', () => {
  it('returns one midnight timestamp per day for the fixed periods', () => {
    expect(getStartOfDayArrayByPeriod('week')).toHaveLength(7)
    expect(getStartOfDayArrayByPeriod('month')).toHaveLength(30)
    expect(getStartOfDayArrayByPeriod('3-month')).toHaveLength(90)
    expect(getStartOfDayArrayByPeriod('6-month')).toHaveLength(180)
  })

  it('returns an empty array for allTime', () => {
    expect(getStartOfDayArrayByPeriod('allTime')).toEqual([])
  })

  it('returns a full leap-aware year of days for year', () => {
    const length = getStartOfDayArrayByPeriod('year').length
    expect(length).toBeGreaterThanOrEqual(365)
    expect(length).toBeLessThanOrEqual(367)
  })

  it('returns only start-of-day timestamps ending today', () => {
    const arr = getStartOfDayArrayByPeriod('week')
    arr.forEach(ts => {
      const d = new Date(ts)
      expect(d.getHours()).toBe(0)
      expect(d.getMinutes()).toBe(0)
      expect(d.getSeconds()).toBe(0)
    })
    const last = new Date(arr[arr.length - 1])
    const today = new Date()
    expect(last.getFullYear()).toBe(today.getFullYear())
    expect(last.getMonth()).toBe(today.getMonth())
    expect(last.getDate()).toBe(today.getDate())
  })

  it('throws on an unknown period', () => {
    expect(() => getStartOfDayArrayByPeriod('day' as any)).toThrow(
      'Invalid time period'
    )
  })
})

describe('roundToNearestMultipleOf5', () => {
  it('floors to the nearest multiple of 5', () => {
    expect(roundToNearestMultipleOf5(0)).toBe(0)
    expect(roundToNearestMultipleOf5(4)).toBe(0)
    expect(roundToNearestMultipleOf5(5)).toBe(5)
    expect(roundToNearestMultipleOf5(14)).toBe(10)
    expect(roundToNearestMultipleOf5(99)).toBe(95)
  })
})

const makeExercise = (
  weights: { weight: number }[],
  workoutDate: number | null
): ExercisesServerDataType =>
  ({
    id: `${workoutDate}-${weights.map(w => w.weight).join('-')}`,
    index: 0,
    name: 'bench',
    originalString: '',
    weights: weights.map(w => ({ sets: [5], weight: w.weight, comment: '' })),
    workoutDate,
    workoutID: 'w1',
    maxWeight: Math.max(...weights.map(w => w.weight)),
  }) as ExercisesServerDataType

describe('formatChartData', () => {
  it('returns an empty object for null input', () => {
    expect(formatChartData(null)).toEqual({})
  })

  it('keeps one point per day, picking the heavier exercise for that day', () => {
    const day = new Date(2026, 5, 10).getTime()
    const data = [
      makeExercise([{ weight: 100 }], day),
      makeExercise([{ weight: 100 }, { weight: 200 }], day), // total 300, max 200
      makeExercise([{ weight: 180 }], new Date(2026, 5, 12).getTime()),
    ]

    const { formattedData, yMin, yMax } = formatChartData(data)

    expect(formattedData).toHaveLength(2)
    const firstPoint = formattedData.find(
      p => p.x && p.x.getTime() === new Date(2026, 5, 10).getTime()
    )
    expect(firstPoint.y).toBe(200)
    expect(yMin).toBe(95) // floor((100 - 5) / 5) * 5
    expect(yMax).toBe(205) // floor((200 + 5) / 5) * 5
  })

  it('drops exercises without weights or a workout date', () => {
    const day = new Date(2026, 5, 10).getTime()
    const data = [
      makeExercise([], day),
      makeExercise([{ weight: 100 }], null),
      makeExercise([{ weight: 135 }], day),
    ]

    const { formattedData } = formatChartData(data)
    expect(formattedData).toHaveLength(1)
    expect(formattedData[0].y).toBe(135)
  })

  it('leaves y bounds undefined when no exercise has weight data', () => {
    const { formattedData, yMin, yMax } = formatChartData([
      makeExercise([], new Date(2026, 5, 10).getTime()),
    ])
    expect(formattedData).toEqual([])
    expect(yMin).toBeUndefined()
    expect(yMax).toBeUndefined()
  })
})

describe('getChartTimeUnit', () => {
  it('uses day units for week, month, and 3-month spans', () => {
    expect(getChartTimeUnit('week').unit).toBe('day')
    expect(getChartTimeUnit('month').unit).toBe('day')
    expect(getChartTimeUnit('3-month').unit).toBe('day')
  })

  it('uses month units for half-year and year spans', () => {
    expect(getChartTimeUnit('6-month').unit).toBe('month')
    expect(getChartTimeUnit('year').unit).toBe('month')
  })

  it('formats month ticks as short names', () => {
    expect(getChartTimeUnit('year').displayFormats.month).toBe('MMM')
  })
})

describe('getStepSize', () => {
  it('returns 5 when either bound is missing', () => {
    expect(getStepSize(undefined, 100)).toBe(5)
    expect(getStepSize(100, undefined)).toBe(5)
    expect(getStepSize(undefined, undefined)).toBe(5)
  })
})
