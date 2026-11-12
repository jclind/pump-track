import { ExerciseDataType } from '../types'

export const getDataFromExercise = (exercise: ExerciseDataType) => {
  let originalStr = exercise.originalString.toLowerCase()

  originalStr = originalStr.replace(exercise.name, '').trim()

  // Work group by group, keeping the separators as typed. Matching each
  // weight across the whole string tagged the first equal number instead,
  // so "30 10/20 10/10 12" became "30lbs 10lbs/20 10/10 12".
  const parts = originalStr.split(/(\s*\/\s*)/)
  let groupIndex = 0
  return parts
    .map(part => {
      if (part.trim() === '/') return part
      const weightGroup = exercise.weights[groupIndex++]
      let group = part.trim()
      if (!weightGroup) return group
      const currWeight = weightGroup.weight.toString()
      const currComment = weightGroup.comment.toLowerCase()
      // Keep a unit the user typed ("100kg"); tag a bare number with lbs.
      if (
        group.startsWith(currWeight) &&
        !/^[a-z]/i.test(group.slice(currWeight.length))
      ) {
        group = currWeight + 'lbs' + group.slice(currWeight.length)
      }
      if (currComment) group = group.replace(currComment, '')
      return group.trim()
    })
    .join('')
    .trim()
}
