import React, { useEffect, useState } from 'react'
import './Dashboard.scss'
import ExerciseChartContainer from '../../Components/Dashboard/ExerciseChartContainer/ExerciseChartContainer'

const Charts = () => {
  return (
    <div className='dashboard-page'>
      dashboard
      <ExerciseChartContainer />
    </div>
  )
}

export default Charts
