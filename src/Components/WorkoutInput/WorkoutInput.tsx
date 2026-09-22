import React, { useState } from 'react'
import './WorkoutInput.scss'

const WorkoutInput = () => {
  const [workoutTitle, setWorkoutTitle] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const isFaded = workoutTitle && !isFocused

  return (
    <div className='input-container'>
      <label className={isFaded ? 'fade' : ''}>Workout Title</label>
      <input
        type='text'
        className={`workout-title-input ${isFaded ? 'fade' : ''}`}
        value={workoutTitle}
        onChange={e => setWorkoutTitle(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  )
}

export default WorkoutInput
