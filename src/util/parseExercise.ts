import { ExerciseDataType, WeightGroupType } from '../types'
import { v4 as uuidv4 } from 'uuid'

const getSubstringUntilNumber = (str: string) => {
  const match = str.match(/^(.*?)(?=\d)/)
  if (match) {
    return match[1]
  }
  return str
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
      const sets = Number(nums[0])
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
  const exerciseName = getSubstringUntilNumber(str).trim()

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
