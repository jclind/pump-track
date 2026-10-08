import React, { useEffect, useState } from 'react'
import './ExercisePR.scss'
import { ExercisePRWeightOBJ } from '../../types'
import { getSingleExercisePR } from '../../services/tracker'
import Skeleton from '@mui/material/Skeleton'
import styles from '../../_exports.module.scss'
import { formatDateToString } from '../../util/dateUtil'

type ExercisePRProps = {
  exerciseName: string
}

const ExercisePR = ({ exerciseName }: ExercisePRProps) => {
  const [currPRData, setCurrPRData] = useState<undefined | ExercisePRWeightOBJ>(
    undefined
  )

  useEffect(() => {
    // Refetch when the chart switches exercise; ignore a reply for the old one.
    let current = true
    setCurrPRData(undefined)
    getSingleExercisePR(exerciseName).then(res => {
      if (!current) return
      if (!res) setCurrPRData({ maxWeight: null, workoutDate: null })
      else setCurrPRData(res)
    })
    return () => {
      current = false
    }
  }, [exerciseName])

  return (
    <div className='exercise-pr'>
      <div className='label-text'>PR:</div>
      {currPRData === undefined ? (
        <Skeleton
          sx={{ bgcolor: styles.tertiaryBackground }}
          variant='text'
          width={60}
          height={25}
        />
      ) : !currPRData.maxWeight ? (
        <span className='weight'>None</span>
      ) : (
        <>
          <span className='weight'>{`${currPRData.maxWeight}lbs`}</span>
          {currPRData.workoutDate && (
            <span className='pr-date'>
              - {formatDateToString(currPRData.workoutDate)}
            </span>
          )}
        </>
      )}
    </div>
  )
}

export default ExercisePR
