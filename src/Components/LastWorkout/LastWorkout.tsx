import React, { useEffect, useState } from 'react'
import './LastWorkout.scss'
import { getMostRecentWorkout } from '../../services/tracker'
import { WorkoutDataType } from '../../types'
import { formatDateToString } from '../../util/dateUtil'
import Skeleton from '@mui/material/Skeleton'
import styles from '../../_exports.module.scss'

const LastWorkout = () => {
  const [workout, setWorkout] = useState<WorkoutDataType | null>(null)
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    getMostRecentWorkout()
      .then(res => {
        if (res) {
          setWorkout(res)
          setLoading(false)
        } else {
          setNoData(true)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className='last-workout-container'>
      <div className='account-header'>Last Workout</div>
      <div className='last-workout'>
        {noData ? (
          <h3>No Workouts Completed</h3>
        ) : (
          <>
            <div className='head'>
              <div className='title'>
                {!workout || loading ? (
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={60}
                    height={22}
                  />
                ) : (
                  workout.name
                )}
              </div>
              <div className='date'>
                {!workout || loading ? (
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={60}
                    height={18}
                  />
                ) : workout?.date ? (
                  formatDateToString(workout.date)
                ) : (
                  ''
                )}
              </div>
            </div>
            <div className='exercises'>
              {!workout || loading ? (
                <>
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={300}
                    height={18}
                  />
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={300}
                    height={18}
                  />
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={300}
                    height={18}
                  />
                  <Skeleton
                    sx={{ bgcolor: styles.tertiaryBackground }}
                    variant='rounded'
                    width={300}
                    height={18}
                  />
                </>
              ) : (
                workout.exercises.map(exercise => {
                  const exerciseName = exercise.name
                  const remainingStr = exercise.originalString.replace(
                    exerciseName,
                    ''
                  )
                  return (
                    <div className='exercise' key={exercise.id}>
                      <span className='exercise-name'>{exerciseName}</span>
                      {remainingStr}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LastWorkout
