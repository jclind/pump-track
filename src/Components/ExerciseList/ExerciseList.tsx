import React, { RefObject, useEffect, useRef, useState } from 'react'
import './ExerciseList.scss'
import { parseExerciseData } from '../../util/parseExerciseData'
import { AiFillInfoCircle, AiOutlinePlusCircle } from 'react-icons/ai'
import InfoModal from '../InfoModal/InfoModal'
import FormInput from '../FormInput/FormInput'
import { v4 as uuidv4 } from 'uuid'

type ExerciseInputsProps = {
  exercise: ExerciseType
  idx: number
  numExercises: number
  exercises: ExerciseType[]
  addExercise: () => string
  removeExercise: (id: string) => void
}

const test: { [x: string]: React.RefObject<HTMLInputElement> } = {}

const ExerciseInputs = ({
  exercise,
  idx,
  numExercises,
  exercises,
  addExercise,
  removeExercise,
}: ExerciseInputsProps) => {
  const [name, setName] = useState('')
  const [data, setData] = useState('')

  const nextID = exercises[idx + 1]?.id || null

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (exercise.id) {
      test[exercise.id] = inputRef
    }
  }, [])

  const handleEnter = (id: string | null) => {
    console.log('Curr:', exercise.id, 'Next:', id)
    if (id) {
      const focusRef = test[id]
      console.log(test)
      console.log(focusRef)
      console.log(id)
      if (id && focusRef && focusRef.current) {
        focusRef.current.focus()
      }
    } else {
      const nextID = addExercise()
      setTimeout(() => {
        handleEnter(nextID)
      }, 0)
    }
  }

  const handleBackspace = () => {
    if (numExercises > 1) {
      removeExercise(exercise.id)

      const nextExerciseFocus = exercises[idx - 1] || exercises[0]
      const nextExerciseFocusID = nextExerciseFocus.id
      const focusRef = test[nextExerciseFocusID]
      if (nextExerciseFocusID && focusRef && focusRef.current) {
        focusRef.current.focus()
      }
    }
  }

  return (
    <div className='exercise-container'>
      <FormInput
        val={name}
        setVal={setName}
        label={`Exercise ${idx + 1}`}
        LabelInfo={idx === 0 ? <InfoModal /> : null}
        placeholder='deadlifts 100 3x8'
        inputID={exercise.id}
        onEnter={handleEnter}
        onBackspaceEmpty={handleBackspace}
        nextID={nextID}
        inputRef={inputRef}
      />
    </div>
  )
}

type ExerciseType = {
  id: string
  name: string
  sets: { reps: number | null; weight: number | null }[]
}

const generateNewExercise = (): ExerciseType => {
  const id = uuidv4()
  return {
    id,
    name: '',
    sets: [{ reps: null, weight: null }],
  }
}

const ExerciseList = () => {
  const [exercises, setExercises] = useState<ExerciseType[]>([
    generateNewExercise(),
  ])

  const handleAddExercise = (): string => {
    const newExercise = generateNewExercise()
    setExercises(prev => [...prev, newExercise])
    return newExercise.id
  }
  const handleRemoveExercise = (id: string) => {
    setExercises(prev => prev.filter(exercise => exercise.id !== id))
  }

  return (
    <div className='exercise-list'>
      {exercises.map((ex, idx, exercises) => {
        return (
          <ExerciseInputs
            exercise={ex}
            idx={idx}
            numExercises={exercises.length}
            addExercise={handleAddExercise}
            removeExercise={handleRemoveExercise}
            exercises={exercises}
          />
        )
      })}
      <div className='add-exercise'>
        <button className='btn-no-styles' onClick={handleAddExercise}>
          <AiOutlinePlusCircle className='icon' />
          Add Exercise
        </button>
      </div>
    </div>
  )
}

export default ExerciseList
