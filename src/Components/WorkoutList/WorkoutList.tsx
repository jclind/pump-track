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
import TextareaAutosize from '@mui/base/TextareaAutosize'
import { TailSpin } from 'react-loader-spinner'
import { calculateInputWidth } from '../../util/calculateInputWidth'

type ExerciseItemProps = {
  exercise: ExerciseDataType
  handleUpdateExercise: (
    exerciseID: string,
    updatedExerciseStr: string,
    originalExerciseStr: string
  ) => void
}
const ExerciseItem = ({
  exercise,
  handleUpdateExercise,
}: ExerciseItemProps) => {
  const [editedStr, setEditedStr] = useState(exercise.originalString)
  const [isFocused, setIsFocused] = useState(false)
  const [prevTitle, setPrevTitle] = useState('')

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
    setPrevTitle(editedStr)
  }
  const handleBlur = () => {
    setIsFocused(false)
    if (!editedStr.trim()) {
      setEditedStr(exercise.originalString)
    } else if (editedStr.trim() !== exercise.originalString) {
      handleUpdateExercise(exercise.id, editedStr.trim(), prevTitle)
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
      // style={{ width: `${editedStr.length}ch` }}
    />
    // <h3 className='workout-title'>{title}</h3>
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
    getUniqueTitles('workoutTitles').then(res => {
      if (res) {
        setWorkoutTitles(res)
        getNextWorkouts(lastDoc)
      }
    })
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
          const updatedWorkoutList = [...workoutList, ...res.data]
          if (newQuery) {
            setWorkoutList(res.data)
          } else {
            setWorkoutList(updatedWorkoutList)
          }
          setLastDoc(res.lastDoc)
          setIsMoreData(res.totalResults > updatedWorkoutList.length)
        }
        setLoading(false)
        setMoreLoading(false)
      })
      .catch((error: any) => {
        console.log(error)
        toast.error(error.message || error)
        setLoading(false)
        setMoreLoading(false)
      })
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
          const handleUpdateExercise = (
            exerciseID: string,
            updatedExerciseStr: string,
            originalExerciseStr: string
          ) => {
            const currExercise = workout.exercises.find(
              ex => ex.id === exerciseID
            )
            if (currExercise?.originalString !== updatedExerciseStr)
              if (currExercise) {
                const parsedExercise = parseExercise(
                  updatedExerciseStr,
                  exerciseID
                )
                // const updatedWorkoutList: WorkoutDataType[] = workoutList.map(
                //   currWorkout => {
                //     if (currWorkout.id === workout.id) {
                //       const updatedExercises = workout.exercises.map(ex => {
                //         if (ex.id === exerciseID) return currExercise
                //         return ex
                //       })
                //       const updatedWorkout: WorkoutDataType = {
                //         ...currWorkout,
                //         exercises: updatedExercises,
                //       }
                //       return updatedWorkout
                //     }
                //     return currWorkout
                //   }
                // )
                // setWorkoutList(updatedWorkoutList)
                const originalExerciseName =
                  parseExercise(originalExerciseStr).name
                updateExercise(
                  exerciseID,
                  workout.id,
                  workout.exercises,
                  parsedExercise,
                  originalExerciseName
                )
              }
          }
          const handleUpdateTitle = (updatedTitle: string) => {
            if (workout.name !== updatedTitle) {
              updateWorkout(workout, { name: updatedTitle })
            }
          }
          const date = workout.date

          const handleDeleteWorkout = () => {
            const deletePromise = deleteWorkout(workout.id)
            deletePromise.then(() => {
              setWorkoutList(prev => prev.filter(w => w.id !== workout.id))
            })
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
                      key={exercise.id}
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
