import React from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  TimeScale, //Import timescale instead of category for X axis
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
} from 'chart.js'
import {
  ExerciseSelectType,
  ExercisesServerDataType,
  TimePeriodType,
} from '../../types'
import 'chartjs-adapter-moment'

import styles from '../../_exports.module.scss'
import './ExerciseChart.scss'
import {
  formatChartData,
  getChartTimeUnit,
  getStartOfDayArrayByPeriod,
  getStepSize,
} from '../../util/chartUtil'
import { TailSpin } from 'react-loader-spinner'
import { AiOutlineLineChart } from 'react-icons/ai'
import ExercisePR from '../ExercisePR/ExercisePR'

ChartJS.register(
  TimeScale, //Register timescale instead of category for X axis
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip
)

const timeSpanButtons: TimePeriodType[] = [
  'week',
  'month',
  '3-month',
  '6-month',
  'year',
]

type ExerciseChartProps = {
  exerciseData: ExercisesServerDataType[] | null
  timeSpan: TimePeriodType
  selectedExercise: ExerciseSelectType | null
  setTimeSpan: React.Dispatch<React.SetStateAction<TimePeriodType>>
  loading: boolean
}

const ExerciseChart = ({
  exerciseData,
  timeSpan,
  selectedExercise,
  setTimeSpan,
  loading,
}: ExerciseChartProps) => {
  const { formattedData, yMin, yMax } = formatChartData(exerciseData)
  const dates = getStartOfDayArrayByPeriod(timeSpan)

  const options: any = {
    scales: {
      y: {
        min: yMin,
        max: yMax,
        ticks: {
          stepSize: getStepSize(yMin, yMax),
        },
        grid: {
          color: styles.tertiaryBackground,
        },
      },
      x: {
        type: 'time',
        time: getChartTimeUnit(timeSpan),
        min: new Date(dates[0]),
        max: new Date(dates[dates.length - 1]),
        offset: true,
        grid: {
          color: styles.tertiaryBackground,
        },
      },
    },
  }
  const data = {
    datasets: [
      {
        label: selectedExercise?.label ?? '',
        data: formattedData,
        borderColor: styles.secondary,
        lineTension: 0.2,
      },
    ],
  }
  return (
    <>
      <div className='chart-head'>
        <h4>
          {formattedData
            ? `${selectedExercise?.label} Chart`
            : 'Select Exercise...'}
        </h4>
        <div className='time-range'>
          {timeSpanButtons.map(val => {
            return (
              <button
                key={val}
                className={`time-option btn-no-styles ${
                  timeSpan === val ? 'active' : ''
                }`}
                onClick={() => setTimeSpan(val)}
              >
                {val.replace('-', '').match(/^(.*?[A-Za-z])/)?.[1]}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className='no-chart-data chart-data-loading'>
          <TailSpin
            height='25'
            width='25'
            color={styles.secondary}
            ariaLabel='loading'
          />
          <h4>Data Loading</h4>
        </div>
      ) : !selectedExercise ? (
        <div className='no-chart-data chart'>
          <AiOutlineLineChart className='icon' />
          <h4>Exercise Data Shown Here</h4>
        </div>
      ) : formattedData ? (
        <Line data={data} options={options} className='chart' />
      ) : (
        <div className='no-chart-data chart'>
          <AiOutlineLineChart className='icon' />
          <h4>No Data!</h4>
        </div>
      )}
      {selectedExercise?.label && (
        <ExercisePR exerciseName={selectedExercise?.label} />
      )}
    </>
  )
}

export default ExerciseChart
