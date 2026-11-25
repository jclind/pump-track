import React, { useEffect, useState } from 'react'
import { getUniqueTitles, queryChartExerciseData } from '../../services/tracker'

import './Charts.scss'
import { stringArrToSelectArr } from '../../util/stringArrToSelectArr'
import ChartSelect from '../../Components/ChartSelect/ChartSelect'
import {
  ExerciseSelectType,
  ExercisesServerDataType,
  TimePeriodType,
} from '../../types'
import ExerciseChart from '../../Components/ExerciseChart/ExerciseChart'
import { convertToTimeNumber } from '../../util/chartUtil'
import toast from 'react-hot-toast'
import { errorMessage } from '../../util/errorMessage'

const Charts = () => {
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseSelectType | null>(null)
  const [exerciseList, setExerciseList] = useState<
    { label: string; value: string }[]
  >([])
  const [timeSpan, setTimeSpan] = useState<TimePeriodType>('week')
  const [exerciseData, setExerciseData] = useState<
    ExercisesServerDataType[] | null
  >(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getUniqueTitles('exerciseTitles').then(res => {
      if (res) {
        const selectArr = stringArrToSelectArr(res)
        setExerciseList(selectArr)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedExercise) {
      setExerciseData(null)
      return
    }
    // Ignore a reply for an exercise or time span the user has moved off.
    let current = true
    setLoading(true)
    queryChartExerciseData(
      selectedExercise.value,
      convertToTimeNumber(timeSpan)
    )
      .then(res => {
        if (current) setExerciseData(res?.data ?? null)
      })
      .catch((error: unknown) => {
        if (current) {
          setExerciseData(null)
          toast.error(errorMessage(error), { position: 'bottom-center' })
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [selectedExercise, timeSpan])

  return (
    <div className='charts-page'>
      <div className='search-container'>
        <ChartSelect
          options={exerciseList}
          selectedOption={selectedExercise}
          setSelectedOption={setSelectedExercise}
        />
      </div>
      <div className='chart-container'>
        <ExerciseChart
          exerciseData={exerciseData}
          timeSpan={timeSpan}
          selectedExercise={selectedExercise}
          setTimeSpan={setTimeSpan}
          loading={loading}
        />
      </div>
    </div>
  )
}

export default Charts
