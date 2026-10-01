import React, { useEffect, useRef, useState } from 'react'
import './ExerciseList.scss'
import { AiOutlinePlusCircle } from 'react-icons/ai'
import InfoModal from '../InfoModal/InfoModal'
import FormInput from '../FormInput/FormInput'
import { v4 as uuidv4 } from 'uuid'
import {
  addWorkout,
  getCurrentWorkoutData,
  searchExercises,
  updateCurrentWorkout,
} from '../../services/tracker'
import { parseExercise } from '../../util/parseExercise'
import { WorkoutDataType } from '../../types'
import { getDataFromExercise } from '../../util/getDataFromExercise'
import ViewAllExercisesModal from '../ViewAllExercisesModal/ViewAllExercisesModal'
import { TailSpin } from 'react-loader-spinner'
import { toast } from 'react-hot-toast'

const idRefHash: { [x: string]: React.RefObject<HTMLInputElement | null> } = {}

type ExerciseInputsProps = {
  exercise: ExerciseType
  idx: number
  numExercises: number
  exercises: ExerciseType[]
  addExercise: () => string
  removeExercise: (id: string) => void
  updateExercise: (exerciseID: string, text: string) => void
}

const ExerciseInputs = ({
  exercise,
  idx,
  numExercises,
  exercises,
  addExercise,
  removeExercise,
  updateExercise,
}: ExerciseInputsProps) => {
  const [exerciseStr, setExerciseStr] = useState(exercise.text)
  const [exerciseName, setExerciseName] = useState('')
  const [prevExerciseData, setPrevExerciseData] = useState<string>('')
  const [suggestedName, setSuggestedName] = useState('')

  const [showViewAllModal, setShowViewAllModal] = useState(false)

  const nextID = exercises[idx + 1]?.id || null

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (exercise.id) {
      idRefHash[exercise.id] = inputRef
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const parsedExerciseData = parseExercise(exerciseStr)
    setExerciseName(parsedExerciseData.name)
    updateExercise(exercise.id, exerciseStr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseStr])
  useEffect(() => {
    if (exercise.text !== exerciseStr) {
      setExerciseStr(exercise.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (exerciseStr) {
        searchExercises(exerciseName.toLowerCase())
          .then(res => {
            if (res) {
              setSuggestedName(res.name)
              const prevData = getDataFromExercise(res)
              setPrevExerciseData(prevData)
            }
          })
          .catch((error: any) => {
            console.log(error)
            toast.error(error, { position: 'bottom-center' })
          })
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseName])

  const handleEnter = (id: string | null) => {
    if (id) {
      const focusRef = idRefHash[id]
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
      const focusRef = idRefHash[nextExerciseFocusID]
      if (nextExerciseFocusID && focusRef && focusRef.current) {
        focusRef.current.focus()
      }
    }
  }

  return (
    <div className='exercise-container'>
      <FormInput
        val={exerciseStr}
        setVal={setExerciseStr}
        label={`Exercise ${idx + 1}`}
        LabelInfo={idx === 0 ? <InfoModal /> : null}
        placeholder='deadlifts 100 3x8'
        inputID={exercise.id}
        onEnter={handleEnter}
        onBackspaceEmpty={handleBackspace}
        nextID={nextID}
        inputRef={inputRef}
        suggestedText={suggestedName}
      />
      {numExercises > 1 && (
        <button
          className='btn-no-styles remove-exercise-btn'
          onClick={() => removeExercise(exercise.id)}
        >
          remove
        </button>
      )}
      {suggestedName &&
      exerciseName &&
      suggestedName === exerciseName.toLowerCase() ? (
        <div className='prev-exercise-data'>
          <span>Prev weights / sets: </span>
          {prevExerciseData}
          <button
            className='btn-no-styles view-all-btn'
            onClick={() => setShowViewAllModal(true)}
          >
            (view all)
          </button>
          {showViewAllModal && (
            <ViewAllExercisesModal
              exerciseName={exerciseName.toLowerCase()}
              isOpen={showViewAllModal}
              setIsOpen={setShowViewAllModal}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

type ExerciseType = {
  id: string
  text: string
}

const generateNewExercise = (): ExerciseType => {
  const id = uuidv4()
  return {
    id,
    text: '',
  }
}

type ExerciseListProps = {
  setWorkoutList: React.Dispatch<React.SetStateAction<WorkoutDataType[]>>
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  workoutTitle: string
  setWorkoutTitle: React.Dispatch<React.SetStateAction<string>>
}

const ExerciseList = ({
  setWorkoutList,
  loading,
  setLoading,
  workoutTitle,
  setWorkoutTitle,
}: ExerciseListProps) => {
  const [exercises, setExercises] = useState<ExerciseType[]>([
    generateNewExercise(),
  ])

  const [addWorkoutLoading, setAddWorkoutLoading] = useState(false)

  const [titleNextFocusRef, setTitleNextFocusRef] =
    useState<React.RefObject<HTMLInputElement | null>>()

  const clearCurrWorkout = async () => {
    await updateCurrentWorkout('', [generateNewExercise()]).catch(
      (error: any) => {
        toast.error(error, { position: 'bottom-center' })
      }
    )
    setWorkoutTitle('')
    setExercises([generateNewExercise()])
  }

  useEffect(() => {
    setLoading(true)
    getCurrentWorkoutData()
      .then(res => {
        if (res) {
          setExercises(res.exercises)
          setWorkoutTitle(res.workoutTitle)
        }
        setLoading(false)
      })
      .catch((error: any) => {
        toast.error(error, { position: 'bottom-center' })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTitleNextFocusRef(idRefHash[exercises[0].id])
  }, [exercises])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (!loading && !addWorkoutLoading) {
        updateCurrentWorkout(workoutTitle, exercises).catch((error: any) => {
          toast.error(error, { position: 'bottom-center' })
        })
      }
    }, 1000)

    return () => clearTimeout(delayDebounce)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutTitle, exercises])

  const handleAddExercise = (): string => {
    const newExercise = generateNewExercise()
    setExercises(prev => [...prev, newExercise])
    return newExercise.id
  }
  const handleRemoveExercise = (id: string) => {
    setExercises(prev => prev.filter(exercise => exercise.id !== id))
  }

  const updateExercise = (exerciseID: string, text: string) => {
    if (!loading && !addWorkoutLoading) {
      setExercises(prev => {
        const newObj = prev.map(ex => {
          if (ex.id === exerciseID) {
            return { id: exerciseID, text }
          }
          return ex
        })
        return [...newObj]
      })
    }
  }

  const handleAddWorkout = () => {
    setAddWorkoutLoading(true)
    addWorkout(workoutTitle, exercises)
      .then(workoutData => {
        if (!workoutData) throw new Error('Something went wrong')
        clearCurrWorkout().then(() => setAddWorkoutLoading(false))
        setWorkoutList(prev => [workoutData, ...prev])
      })
      .catch((error: any) => {
        console.log(error)
        setAddWorkoutLoading(false)
        toast.error(error, { position: 'bottom-center' })
      })
  }

  return (
    <div className='exercise-form'>
      <FormInput
        val={workoutTitle}
        setVal={setWorkoutTitle}
        label='Workout Title'
        nextFocusRef={titleNextFocusRef}
      />
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
              updateExercise={updateExercise}
              key={ex.id}
            />
          )
        })}
        <div className='btns'>
          <div className='add-exercise'>
            <button className='btn-no-styles' onClick={handleAddExercise}>
              <AiOutlinePlusCircle className='icon' />
              Add Exercise
            </button>
          </div>
          {workoutTitle && exercises[0].text ? (
            <button
              className='submit-btn'
              onClick={handleAddWorkout}
              disabled={addWorkoutLoading}
            >
              {addWorkoutLoading ? (
                <TailSpin
                  height='25'
                  width='25'
                  color='#303841'
                  ariaLabel='loading'
                />
              ) : (
                'Add Workout'
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ExerciseList
