import React, { useEffect, useState } from 'react'
import ChartSelect from '../../ChartSelect/ChartSelect'
import ExerciseChart from './ExerciseChart/ExerciseChart'
import toast from 'react-hot-toast'
import './ExerciseChartContainer.scss'
import {
  getUniqueTitles,
  queryChartExerciseData,
} from '../../../services/tracker'
import {
  ExerciseSelectType,
  TimePeriodType,
  ExercisesServerDataType,
} from '../../../types'
import { convertToTimeNumber } from '../../../util/chartUtil'
import { stringArrToSelectArr } from '../../../util/stringArrToSelectArr'

const ExerciseChartContainer = () => {
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
    if (selectedExercise) {
      setLoading(true)
      queryChartExerciseData(
        selectedExercise.value,
        convertToTimeNumber(timeSpan)
      )
        .then(res => {
          if (res?.data) {
            setExerciseData(res.data ?? null)
          } else {
            setExerciseData(null)
          }
          setLoading(false)
        })
        .catch((error: any) => {
          toast.error(error, { position: 'bottom-center' })
        })
    } else {
      setExerciseData(null)
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

export default ExerciseChartContainer
