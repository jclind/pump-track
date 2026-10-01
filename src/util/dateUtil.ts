export const getMonthDay = (input: number | Date): string => {
  const currentDate = new Date()
  const inputDate = typeof input === 'number' ? new Date(input) : input

  if (isNaN(inputDate.getTime())) {
    throw new Error('Invalid input date.')
  }

  const inputYear = inputDate.getFullYear()
  const currentYear = currentDate.getFullYear()
  // The same month last year counts too, or 2025-10-01 would show as "10/1"
  // on 2026-10-01, the same as today.
  const isMoreThan11Months =
    currentYear - inputYear > 1 ||
    (currentYear - inputYear === 1 &&
      currentDate.getMonth() >= inputDate.getMonth())

  const month = inputDate.getMonth() + 1
  const day = inputDate.getDate()

  if (isMoreThan11Months) {
    return `${month}/${day}/${inputYear}`
  } else {
    return `${month}/${day}`
  }
}

export const formatDateToString = (input: Date | number): string => {
  const currentDate = new Date()
  const inputDate = typeof input === 'number' ? new Date(input) : input
  const oneDay = 24 * 60 * 60 * 1000 // Milliseconds in a day

  if (isNaN(inputDate.getTime())) {
    throw new Error('Invalid input date.')
  }

  // Compare calendar days. Workout dates are local midnight, so a raw
  // millisecond gap made today read "Yesterday" from noon on.
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const timeDifference = Math.round(
    (startOfDay(currentDate) - startOfDay(inputDate)) / oneDay
  )
  if (timeDifference <= 1) {
    // If the date is today or yesterday, return the corresponding string
    return timeDifference === 0 ? 'Today' : 'Yesterday'
  } else if (timeDifference <= 6) {
    // If the date is 6 days or before, return the name of the day
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]
    const dayName = days[inputDate.getDay()]
    return dayName
  } else {
    return getMonthDay(inputDate)
  }
}

export const formatDateToMMMDDYYYY = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }
  return date.toLocaleDateString('en-US', options)
}
