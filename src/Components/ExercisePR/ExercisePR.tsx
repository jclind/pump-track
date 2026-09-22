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
    getSingleExercisePR(exerciseName).then(res => {
      if (!res) setCurrPRData({ maxWeight: null, workoutDate: null })
      else setCurrPRData(res)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (currPRData === undefined) return null

  return (
    <div className='exercise-pr'>
      <div className='label-text'>PR:</div>
      {!currPRData.maxWeight ? (
        <Skeleton
          sx={{ bgcolor: styles.tertiaryBackground }}
          variant='text'
          width={60}
          height={25}
        />
      ) : (
        <>
          <span className='weight'>
            {currPRData.maxWeight === null
              ? 'loading'
              : `${currPRData.maxWeight}lbs`}
          </span>
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
