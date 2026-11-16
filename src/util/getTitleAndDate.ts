const DAY_MS = 24 * 60 * 60 * 1000
// A date typed without a year that lands further ahead than this is taken
// to mean last year, so "12/30" typed on January 2 isn't a future workout.
const FUTURE_GRACE_MS = 3 * DAY_MS

export const getTitleAndDate = (
  str: string
): { title: string; date: number | null } => {
  let title: string
  let formattedDate: number | null = null

  // M/D, M/D/YY, or M/D/YYYY. The lookarounds stop "3/15/24" matching as
  // "3/1" with "5/24" left in the title, and "5/3/1 day" matching as 3/1.
  const dateMatch = str.match(
    /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/
  )
  if (dateMatch) {
    const [, month, day, yearStr] = dateMatch
    let year = new Date().getFullYear()
    if (yearStr) {
      year = Number(yearStr.length === 2 ? `20${yearStr}` : yearStr)
    } else {
      const thisYear = new Date(year, Number(month) - 1, Number(day))
      if (thisYear.getTime() > Date.now() + FUTURE_GRACE_MS) year -= 1
    }
    const parsed = new Date(year, Number(month) - 1, Number(day))
    // The Date constructor rolls 12/32 over to 1/1. Treat that as no date.
    const isRealDate =
      parsed.getFullYear() === year &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    if (isRealDate) {
      formattedDate = parsed.getTime()
      title = str.replace(dateMatch[0], '').trim().toLowerCase()
    } else {
      title = str.trim().toLowerCase()
    }
  } else {
    title = str.trim().toLowerCase()
  }
  return { title, date: formattedDate }
}
