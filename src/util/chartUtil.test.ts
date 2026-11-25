import { afterEach, vi } from 'vitest'
import {
  convertToTimeNumber,
  formatChartData,
  getEndOfDay,
  getStartOfDayArrayByPeriod,
  getStepSize,
} from './chartUtil'
import { ExercisesServerDataType, TimePeriodType } from '../types'

const exercise = (
  weights: number[],
  workoutDate: number
): ExercisesServerDataType => ({
  id: `${workoutDate}-${weights.join('-')}`,
  index: 0,
  name: 'pull ups',
  originalString: '',
  weights: weights.map(weight => ({ weight, sets: [10], comment: '' })),
  workoutDate,
  workoutID: 'w1',
  maxWeight: weights.length ? Math.max(...weights) : 0,
})

describe('convertToTimeNumber', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('starts at local midnight of the first day on the x-axis', () => {
    vi.useFakeTimers()
    // The 31st, where setMonth used to overflow.
    vi.setSystemTime(new Date(2026, 9, 31, 15, 45))
    const periods: TimePeriodType[] = [
      'week',
      'month',
      '3-month',
      '6-month',
      'year',
    ]
    for (const period of periods) {
      expect(convertToTimeNumber(period)).toBe(
        getStartOfDayArrayByPeriod(period)[0]
      )
    }
    expect(convertToTimeNumber('month')).toBe(new Date(2026, 9, 2).getTime())
  })
})

describe('formatChartData with bodyweight entries', () => {
  test('plots an exercise whose heaviest weight is 0', () => {
    const day = new Date(2026, 5, 10).getTime()
    const { formattedData, yMin, yMax } = formatChartData([exercise([0], day)])

    expect(formattedData).toHaveLength(1)
    expect(formattedData![0].y).toBe(0)
    expect(yMin).toBe(0)
    expect(yMax).toBe(5)
  })

  test('skips an entry with no weights on a day that has others', () => {
    const day = new Date(2026, 5, 10).getTime()
    const { formattedData } = formatChartData([
      exercise([], day),
      exercise([0], day),
    ])

    expect(formattedData).toHaveLength(1)
    expect(formattedData![0].y).toBe(0)
  })

  test('getStepSize works when the lower bound is 0', () => {
    expect(getStepSize(0, 100)).toBe(15)
  })
})

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
