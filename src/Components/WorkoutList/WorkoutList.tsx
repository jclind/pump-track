import React, { useEffect, useRef, useState } from 'react'
import './WorkoutList.scss'
import { ExerciseDataType, WorkoutDataType } from '../../types'
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import {
  deleteWorkout,
  getUniqueTitles,
  getWorkouts,
  updateExercise,
  updateWorkout,
} from '../../services/tracker'
import { formatDateToString } from '../../util/dateUtil'
import { parseExercise } from '../../util/parseExercise'
import { BsChevronCompactDown } from 'react-icons/bs'
import ActionsDropdown from '../ActionsDropdown/ActionsDropdown'
import { BsTrashFill } from 'react-icons/bs'
import toast from 'react-hot-toast'
import TextareaAutosize from '@mui/material/TextareaAutosize'
import { TailSpin } from 'react-loader-spinner'
import { calculateInputWidth } from '../../util/calculateInputWidth'
import { errorMessage } from '../../util/errorMessage'

type ExerciseItemProps = {
  exercise: ExerciseDataType
  handleUpdateExercise: (exerciseID: string, updatedExerciseStr: string) => void
}
const ExerciseItem = ({
  exercise,
  handleUpdateExercise,
}: ExerciseItemProps) => {
  const [editedStr, setEditedStr] = useState(exercise.originalString)
  const [isFocused, setIsFocused] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (textareaRef.current) {
        textareaRef.current.blur()
      }
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
  }
  const handleBlur = () => {
    setIsFocused(false)
    if (!editedStr.trim()) {
      setEditedStr(exercise.originalString)
    } else if (editedStr.trim() !== exercise.originalString) {
      handleUpdateExercise(exercise.id, editedStr.trim())
    }
  }

  return (
    <TextareaAutosize
      className={`exercise ${isFocused ? 'focused' : 'blurred'}`}
      value={editedStr}
      onChange={e => setEditedStr(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={textareaRef}
      key={exercise.id}
    />
  )
}

type WorkoutTitleProps = {
  title: string
  handleUpdateTitle: (updatedTitle: string) => void
}

const WorkoutTitle = ({ title, handleUpdateTitle }: WorkoutTitleProps) => {
  const [editedStr, setEditedStr] = useState(title)
  const [isFocused, setIsFocused] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (inputRef.current) {
        inputRef.current.blur()
      }
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (!editedStr.trim()) {
      setEditedStr(title)
    } else if (editedStr.trim() !== title) {
      handleUpdateTitle(editedStr.trim())
    }
  }

  return (
    <input
      className={`workout-title ${isFocused ? 'focused' : 'blurred'}`}
      value={editedStr}
      onChange={e => {
        setEditedStr(e.target.value)
      }}
      onFocus={e => {
        setIsFocused(true)
        e.target.select()
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={inputRef}
      style={{ width: calculateInputWidth(editedStr, 'Nunito', 10) }}
    />
  )
}

type WorkoutListProps = {
  workoutList: WorkoutDataType[]
  setWorkoutList: React.Dispatch<React.SetStateAction<WorkoutDataType[]>>
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  currWorkoutTitle: string
}

const WorkoutList = ({
  workoutList,
  setWorkoutList,
  setLoading,
}: WorkoutListProps) => {
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<
    DocumentData,
    DocumentData
  > | null>(null)
  const [isMoreData, setIsMoreData] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [nameFilter, setNameFilter] = useState<string | null>(null)
  const [workoutTitles, setWorkoutTitles] = useState<string[]>([])

  const titleRef = useRef<HTMLHeadingElement>(null)
  const scrollParentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    getUniqueTitles('workoutTitles')
      .then(res => {
        if (res) setWorkoutTitles(res)
      })
      .finally(() => getNextWorkouts(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (nameFilter !== null) {
      getNextWorkouts(null, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter])

  const handleScroll = () => {
    if (titleRef?.current) {
      titleRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const getNextWorkouts = (
    lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null,
    newQuery: boolean = false
  ) => {
    setMoreLoading(true)
    getWorkouts(15, lastDoc, nameFilter)
      .then(res => {
        if (res?.data) {
          const updatedWorkoutList = newQuery
            ? res.data
            : [...workoutList, ...res.data]
          setWorkoutList(updatedWorkoutList)
          setLastDoc(res.lastDoc)
          setIsMoreData(res.totalResults > updatedWorkoutList.length)
        }
      })
      .catch((error: unknown) => {
        console.log(error)
        toast.error(errorMessage(error), { position: 'bottom-center' })
      })
      .finally(() => {
        setLoading(false)
        setMoreLoading(false)
      })
  }

  const replaceWorkout = (
    workoutID: string,
    update: (workout: WorkoutDataType) => WorkoutDataType
  ) => {
    setWorkoutList(prev =>
      prev.map(workout =>
        workout.id === workoutID ? update(workout) : workout
      )
    )
  }

  const setExerciseInList = (workoutID: string, exercise: ExerciseDataType) => {
    replaceWorkout(workoutID, workout => ({
      ...workout,
      exercises: workout.exercises.map(ex =>
        ex.id === exercise.id ? exercise : ex
      ),
    }))
  }

  if (workoutList.length <= 0 && !nameFilter) return null

  return (
    <div className='workout-list-container' ref={scrollParentRef}>
      <button
        className='scroll-to-workouts-btn btn-no-styles'
        onClick={handleScroll}
      >
        Workouts{' '}
        <div className='icons'>
          <BsChevronCompactDown className='icon' />
          <BsChevronCompactDown className='icon' />
        </div>
      </button>
      <div className='title-content'>
        <h5 className='title' ref={titleRef}>
          Past Workouts
        </h5>

        <div className='workout-titles-list'>
          {workoutTitles.slice(0, 3).map(title => {
            return (
              <button
                key={title}
                className={`btn-no-styles ${
                  title === nameFilter ? 'active' : ''
                }`}
                onClick={() =>
                  setNameFilter(() => {
                    if (nameFilter === title) return ''
                    return title
                  })
                }
              >
                {title}
              </button>
            )
          })}
        </div>
      </div>
      <div className='workout-list'>
        {workoutList.map(workout => {
          // The list is updated before the save, so a second edit in the
          // same workout builds on the first. A failed save puts back only
          // the exercise it changed.
          const handleUpdateExercise = (
            exerciseID: string,
            updatedExerciseStr: string
          ) => {
            const currExercise = workout.exercises.find(
              ex => ex.id === exerciseID
            )
            if (
              !currExercise ||
              currExercise.originalString === updatedExerciseStr
            )
              return
            const parsedExercise = parseExercise(updatedExerciseStr, exerciseID)
            setExerciseInList(workout.id, parsedExercise)
            updateExercise(workout, parsedExercise).catch((error: unknown) => {
              console.log(error)
              setExerciseInList(workout.id, currExercise)
              toast.error(`Edit not saved: ${errorMessage(error)}`, {
                position: 'bottom-center',
              })
            })
          }
          const handleUpdateTitle = (updatedTitle: string) => {
            const name = updatedTitle.toLowerCase().trim()
            if (!name || workout.name === name) return
            const previousName = workout.name
            replaceWorkout(workout.id, w => ({ ...w, name }))
            updateWorkout(workout, { name }).catch((error: unknown) => {
              console.log(error)
              replaceWorkout(workout.id, w => ({ ...w, name: previousName }))
              toast.error(`Title not saved: ${errorMessage(error)}`, {
                position: 'bottom-center',
              })
            })
          }
          const date = workout.date

          const handleDeleteWorkout = () => {
            const deletePromise = deleteWorkout(workout.id)
            // toast.promise shows the failure.
            deletePromise.then(
              () => {
                setWorkoutList(prev => prev.filter(w => w.id !== workout.id))
              },
              () => {}
            )
            toast.promise(
              deletePromise,
              {
                loading: 'Deleting...',
                success: 'Workout Deleted',
                error: 'Failed To Delete',
              },
              {
                position: 'bottom-center',
              }
            )
          }

          return (
            <div className='single-workout' key={workout.id}>
              <div className='head'>
                <WorkoutTitle
                  // Remount when the stored title changes, so the input
                  // shows the saved form or the title a failed save restored.
                  key={workout.name}
                  title={workout.name}
                  handleUpdateTitle={handleUpdateTitle}
                />
                {date && <div className='date'>{formatDateToString(date)}</div>}
                <div className='actions'>
                  <ActionsDropdown
                    buttons={[
                      {
                        text: 'Delete',
                        icon: <BsTrashFill className='icon' />,
                        type: 'danger',
                        confirm: true,
                        action: handleDeleteWorkout,
                      },
                    ]}
                  />
                </div>
              </div>
              <div className='exercise-list'>
                {workout.exercises.map(exercise => {
                  return (
                    <ExerciseItem
                      key={`${exercise.id}:${exercise.originalString}`}
                      exercise={exercise}
                      handleUpdateExercise={handleUpdateExercise}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
        {isMoreData && (
          <button
            className='btn-no-styles load-more'
            disabled={moreLoading}
            onClick={() => getNextWorkouts(lastDoc)}
          >
            {moreLoading ? (
              <TailSpin
                height='25'
                width='25'
                color='#303841'
                ariaLabel='loading'
              />
            ) : (
              'Load More'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default WorkoutList
