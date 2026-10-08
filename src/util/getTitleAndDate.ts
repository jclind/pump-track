export const getTitleAndDate = (
  str: string
): { title: string; date: number | null } => {
  let title: string
  let formattedDate: number | null = null

  // M/D, M/D/YY, or M/D/YYYY. The lookaheads stop "3/15/24" matching as
  // "3/1" with "5/24" left in the title.
  const dateMatch = str.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/
  )
  if (dateMatch) {
    const [, month, day, yearStr] = dateMatch
    let year = new Date().getFullYear()
    if (yearStr) year = Number(yearStr.length === 2 ? `20${yearStr}` : yearStr)
    formattedDate = new Date(year, Number(month) - 1, Number(day)).getTime()
    title = str.replace(dateMatch[0], '').trim().toLowerCase()
  } else {
    title = str.trim().toLowerCase()
  }
  return { title, date: formattedDate }
}
