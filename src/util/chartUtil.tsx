import {
  ExercisesServerDataType,
  TimePeriodType,
  WeightGroupType,
} from '../types'

export const convertToTimeNumber = (timePeriod: TimePeriodType): number => {
  const currentDate = new Date()
  if (timePeriod === 'allTime') {
    return 0
  } else if (timePeriod === 'year') {
    const oneYearAgo = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate()
    )
    return oneYearAgo.getTime()
  } else if (
    timePeriod === 'month' ||
    timePeriod === '3-month' ||
    timePeriod === '6-month'
  ) {
    const period = timePeriod === 'month' ? 1 : timePeriod === '3-month' ? 2 : 3
    const oneMonthAgo = new Date(currentDate.getTime())
    oneMonthAgo.setMonth(currentDate.getMonth() - period)
    return oneMonthAgo.getTime()
  } else if (timePeriod === 'week') {
    const oneWeekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    return oneWeekAgo.getTime()
  } else {
    throw new Error('Invalid time period')
  }
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
    let maxWeight = 0
    let exerciseWithMaxWeight: ExercisesServerDataType | null = null

    exercisesGroup.forEach(exercise => {
      const totalWeight = exercise.weights.reduce(
        (acc, weightGroup) => acc + weightGroup.weight,
        0
      )

      if (totalWeight > maxWeight) {
        maxWeight = totalWeight
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

        if (currExerciseMinWeight && currExerciseMaxWeight) {
          if (!minWeight || currExerciseMinWeight < minWeight)
            minWeight = currExerciseMinWeight
          if (!maxWeight || currExerciseMaxWeight > maxWeight)
            maxWeight = currExerciseMaxWeight
        }

        const workoutDate = ex.workoutDate ? new Date(ex.workoutDate) : null

        return { x: workoutDate, y: currExerciseMaxWeight }
      })
    const yMin = minWeight
      ? roundToNearestMultipleOf5(minWeight - 5)
      : undefined
    const yMax = maxWeight
      ? roundToNearestMultipleOf5(maxWeight + 5)
      : undefined
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
  if (!min || !max) {
    return 5
  }
  const minMaxDiff = min - max
  const stepSize =
    minMaxDiff < 40 ? 5 : minMaxDiff < 80 ? 10 : minMaxDiff < 130 ? 15 : 20
  return stepSize
}
