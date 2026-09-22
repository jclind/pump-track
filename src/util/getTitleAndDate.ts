export const getTitleAndDate = (
  str: string
): { title: string; date: number | null } => {
  let title: string
  let formattedDate: number | null = null

  const dateMatch = str.match(
    /(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}(?!\/))/
  )
  if (dateMatch) {
    const shortDateRegex = /^\d{1,2}\/\d{1,2}$/
    if (shortDateRegex.test(dateMatch[1])) {
      const dateWithCurrYear = `${dateMatch[1]}/${new Date().getFullYear()}`
      formattedDate = new Date(Date.parse(dateWithCurrYear)).getTime()
    } else {
      formattedDate = new Date(Date.parse(dateMatch[1])).getTime()
    }
    title = str.replace(dateMatch[0], '').trim().toLowerCase()
  } else {
    title = str.trim().toLowerCase()
  }
  return { title, date: formattedDate }
}
