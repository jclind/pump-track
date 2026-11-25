import {
  ExercisesServerDataType,
  TimePeriodType,
  WeightGroupType,
} from '../types'

// The query starts at the first day on the chart's x-axis, at local midnight,
// so the data and the axis cover the same days.
export const convertToTimeNumber = (timePeriod: TimePeriodType): number => {
  if (timePeriod === 'allTime') return 0
  const days = getStartOfDayArrayByPeriod(timePeriod)
  return days[0]
}

export const getStartOfDayArrayByPeriod = (
  timePeriod: TimePeriodType
): number[] => {
  const currentDate = new Date()
  const startOfDayArray: number[] = []

  if (timePeriod === 'allTime') {
    // allTime keeps the array empty; the chart plots over every date in the data
  } else if (timePeriod === 'year') {
    // For 'year', calculate the start of the year and add each day to the array
    const currentYear = currentDate.getFullYear()
    const startDate = new Date(new Date().setFullYear(currentYear - 1)) // Start of the current year
    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setDate(date.getDate() + 1)
    ) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      startOfDayArray.push(startOfDay.getTime())
    }
  } else if (
    timePeriod === 'month' ||
    timePeriod === '3-month' ||
    timePeriod === '6-month'
  ) {
    // For 'month', '3-month', and '6-month', calculate the start of the period and add each day to the array
    const period =
      timePeriod === 'month' ? 30 : timePeriod === '3-month' ? 90 : 180
    const startDate = new Date(currentDate)
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - period + 1)
    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setDate(date.getDate() + 1)
    ) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      startOfDayArray.push(startOfDay.getTime())
    }
  } else if (timePeriod === 'week') {
    // For 'week', calculate the start of one week ago and add each day to the array
    const startDate = new Date(currentDate)
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - 6) // Go back to the last 7 days
    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setDate(date.getDate() + 1)
    ) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      startOfDayArray.push(startOfDay.getTime())
    }
  } else {
    throw new Error('Invalid time period')
  }

  return startOfDayArray
}

export const getEndOfDay = (timestamp: number): Date => {
  const endOfDay = new Date(timestamp)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay
}

export const roundToNearestMultipleOf5 = (number: number): number => {
  return Math.floor(number / 5) * 5
}
const getExerciseWeightRange = (
  weightGroups: WeightGroupType[]
): { min: number; max: number } | undefined => {
  if (weightGroups.length === 0) {
    return undefined
  }

  let minWeight = weightGroups[0].weight
  let maxWeight = weightGroups[0].weight

  weightGroups.forEach(group => {
    if (group.weight < minWeight) {
      minWeight = group.weight
    }
    if (group.weight > maxWeight) {
      maxWeight = group.weight
    }
  })

  return { min: minWeight, max: maxWeight }
}
const findExercisesWithLargestWeight = (
  exercises: ExercisesServerDataType[]
): ExercisesServerDataType[] => {
  const exercisesByDate: { [key: string]: ExercisesServerDataType[] } = {}

  // Group exercises by workout date
  exercises.forEach(exercise => {
    if (exercise.workoutDate !== null) {
      const workoutDate = new Date(exercise.workoutDate).toDateString()
      exercisesByDate[workoutDate] = exercisesByDate[workoutDate] || []
      exercisesByDate[workoutDate].push(exercise)
    }
  })

  const filteredExercises: ExercisesServerDataType[] = []

  // Find exercise with largest weight for each group
  for (const date in exercisesByDate) {
    const exercisesGroup = exercisesByDate[date]
    // Starts below zero so a bodyweight exercise logged at 0 still plots.
    let maxWeight = -Infinity
    let exerciseWithMaxWeight: ExercisesServerDataType | null = null

    exercisesGroup.forEach(exercise => {
      if (exercise.weights.length === 0) return
      const heaviest = Math.max(
        ...exercise.weights.map(weightGroup => weightGroup.weight)
      )

      if (heaviest > maxWeight) {
        maxWeight = heaviest
        exerciseWithMaxWeight = exercise
      }
    })

    if (exerciseWithMaxWeight) {
      filteredExercises.push(exerciseWithMaxWeight)
    }
  }

  return filteredExercises
}
export const formatChartData = (
  exerciseData: ExercisesServerDataType[] | null
) => {
  if (exerciseData) {
    const filteredExerciseData = findExercisesWithLargestWeight(exerciseData)
    let maxWeight: number | null = null
    let minWeight: number | null = null

    const formattedData = filteredExerciseData
      .filter(ex => ex.weights.length > 0)
      .map(ex => {
        const { min: currExerciseMinWeight, max: currExerciseMaxWeight } =
          getExerciseWeightRange(ex.weights) ?? {}

        if (
          currExerciseMinWeight !== undefined &&
          currExerciseMaxWeight !== undefined
        ) {
          if (minWeight === null || currExerciseMinWeight < minWeight)
            minWeight = currExerciseMinWeight
          if (maxWeight === null || currExerciseMaxWeight > maxWeight)
            maxWeight = currExerciseMaxWeight
        }

        const workoutDate = ex.workoutDate ? new Date(ex.workoutDate) : null

        return { x: workoutDate, y: currExerciseMaxWeight }
      })
    // Weights are never negative, so the axis stops at 0.
    const yMin =
      minWeight !== null
        ? Math.max(0, roundToNearestMultipleOf5(minWeight - 5))
        : undefined
    const yMax =
      maxWeight !== null ? roundToNearestMultipleOf5(maxWeight + 5) : undefined
    return { formattedData, yMin, yMax }
  }
  return {}
}

export const getChartTimeUnit = (timeSpan: TimePeriodType) => {
  let unit: string = 'day'

  if (timeSpan === 'week' || timeSpan === 'month') unit = 'day'
  else if (timeSpan === '6-month' || timeSpan === 'year') unit = 'month'

  return {
    unit,
    displayFormats: {
      month: 'MMM',
    },
  }
}

export const getStepSize = (
  min: number | undefined,
  max: number | undefined
) => {
  if (min === undefined || max === undefined) {
    return 5
  }
  const minMaxDiff = max - min
  const stepSize =
    minMaxDiff < 40 ? 5 : minMaxDiff < 80 ? 10 : minMaxDiff < 130 ? 15 : 20
  return stepSize
}
