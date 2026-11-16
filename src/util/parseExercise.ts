import { ExerciseDataType, WeightGroupType } from '../types'
import { v4 as uuidv4 } from 'uuid'

// A typo like "100000000x1" would otherwise freeze the tab.
const MAX_SETS = 100

const WEIGHT_WITH_UNIT = /^\d+(\.\d+)?(kg|kgs|lb|lbs)$/i
const SETS_BY_REPS = /^\d+x\d+$/i
const UNIT_OR_X = /^(kg|kgs|lb|lbs|x)$/i

const getSubstringUntilNumber = (str: string) => {
  const match = str.match(/^(.*?)(?=\d)/)
  if (match) {
    return match[1]
  }
  return str
}

// The name runs up to the first digit. A line that starts with a digit
// ("21s 30 3x7", "3 point row 50 3x10") would get no name that way, so
// there the first token joins the name when it holds letters and isn't a
// weight like "100kg", or when it's a bare number followed by a word.
const getExerciseName = (str: string) => {
  const name = getSubstringUntilNumber(str).trim()
  if (name) return name

  const tokens = str.trim().split(/\s+/)
  const [first, second] = tokens
  if (!first) return ''

  const firstIsName =
    (/[a-z]/i.test(first) &&
      !WEIGHT_WITH_UNIT.test(first) &&
      !SETS_BY_REPS.test(first)) ||
    (/^\d+$/.test(first) &&
      !!second &&
      /^[a-z]/i.test(second) &&
      !UNIT_OR_X.test(second))
  if (!firstIsName) return ''

  const rest = str.trim().slice(first.length)
  return (first + getSubstringUntilNumber(rest)).trim()
}
const getFirstNumber = (str: string): { number: string; end: string } => {
  const regex = /(\d+(?:x\d+)?)/
  const match = str.match(regex)

  if (match) {
    return { number: match[1], end: str.replace(match[1], '') }
  }

  return { number: '', end: str }
}
const formatSets = (sets: string[]): number[] => {
  const formattedSets: number[] = []

  sets.forEach(val => {
    const nums = val.split('x')
    if (nums.length === 1) formattedSets.push(Number(val))
    else if (nums.length === 2) {
      const sets = Math.min(Number(nums[0]), MAX_SETS)
      const reps = Number(nums[1])
      for (let i = 0; i < sets; i++) {
        formattedSets.push(reps)
      }
    }
  })

  return formattedSets
}

export const parseExercise = (
  str: string,
  persistentID: string | null = null
): ExerciseDataType => {
  const exerciseName = getExerciseName(str)

  const titleWithoutName = str.replace(exerciseName, '').trim()
  const weightGroupsStr = titleWithoutName.split('/')

  const weightGroups: WeightGroupType[] = []

  weightGroupsStr.forEach(weightGroup => {
    const weightGroupStrTrimmed = weightGroup.trim()
    const rawWeight = weightGroupStrTrimmed.substring(
      0,
      weightGroupStrTrimmed.indexOf(' ')
    )
    const weight = rawWeight.replace(/[^0-9.]/g, '')

    const repsAndCommentStr = weightGroup.replace(rawWeight, '').trim()

    const commentArr: string[] = []
    const sets: string[] = []

    repsAndCommentStr.split(',').forEach(val => {
      const { number, end } = getFirstNumber(val)
      if (number) {
        sets.push(number)
      }
      if (end.trim()) commentArr.push(end.trim())
    })

    const comment = commentArr.join(', ')
    const formattedSets: number[] = formatSets(sets)
    weightGroups.push({ weight: Number(weight), sets: formattedSets, comment })
  })

  const exerciseData: ExerciseDataType = {
    id: persistentID || uuidv4(),
    name: exerciseName,
    weights: weightGroups,
    originalString: str,
  }

  return exerciseData
}
