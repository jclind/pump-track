import { v4 as uuidv4 } from 'uuid'
import { WorkoutDataType } from '../types'
import { getTitleAndDate } from './getTitleAndDate'
import { parseExercise } from './parseExercise'

// Workouts are separated by blank lines. The first line of each is the
// title, with an optional date, and every other line is an exercise.
// Returns the workouts that have a title, and how many chunks had none.
export const parseImportText = (
  text: string
): { workouts: WorkoutDataType[]; untitled: number } => {
  const lines = text.replace(/\r\n?/g, '\n')
  const chunks = lines.split(/\n[ \t]*\n/)

  const workouts: WorkoutDataType[] = []
  let untitled = 0

  chunks.forEach(chunk => {
    const workoutLines = chunk
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    if (workoutLines.length === 0) return

    const { title, date } = getTitleAndDate(workoutLines[0])
    if (!title) {
      untitled++
      return
    }

    workouts.push({
      id: uuidv4(),
      name: title,
      date,
      exercises: workoutLines.slice(1).map(line => parseExercise(line)),
    })
  })

  return { workouts, untitled }
}
