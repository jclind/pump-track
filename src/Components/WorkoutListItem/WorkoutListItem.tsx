import React, { useRef, useState } from 'react'
import './WorkoutListItem.scss'
import { ExerciseDataType, WorkoutDataType } from '../../types'
import { parseExercise } from '../../util/parseExercise'
import {
  addAndRemoveExercisesFromWorkout,
  deleteWorkout,
  updateExercise,
  updateWorkout,
} from '../../services/tracker'
import { BsTrashFill } from 'react-icons/bs'
import { BiEdit } from 'react-icons/bi'
import { AiOutlineClose, AiOutlinePlusCircle } from 'react-icons/ai'
import toast from 'react-hot-toast'
import { calculateInputWidth } from '../../util/calculateInputWidth'
import ActionsDropdown from '../ActionsDropdown/ActionsDropdown'
import { formatDateToString } from '../../util/dateUtil'
import TextareaAutosize from '@mui/base/TextareaAutosize'
import { generateNewExercise } from '../ExerciseList/ExerciseList'

type ExerciseItemProps = {
  exercise: ExerciseDataType
  handleUpdateExercise: (
    exerciseID: string,
    updatedExerciseStr: string,
    originalExerciseStr: string
  ) => void
  isEditing: boolean
  handleRemoveExercise: (exerciseID: string) => void
}
const ExerciseItem = ({
  exercise,
  handleUpdateExercise,
  isEditing,
  handleRemoveExercise,
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
    <div className='exercise-item'>
      <TextareaAutosize
        className={`exercise ${isFocused ? 'focused' : 'blurred'} ${
          isEditing ? 'editing' : ''
        }`}
        value={editedStr}
        onChange={e => setEditedStr(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        ref={textareaRef}
        key={exercise.id}
      />
      {isEditing && (
        <button
          className='btn-no-styles delete-exercise-btn'
          onClick={() => handleRemoveExercise(exercise.id)}
        >
          <AiOutlineClose className='icon' />
        </button>
      )}
    </div>
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

type WorkoutListItemProps = {
  workout: WorkoutDataType
  setWorkoutList: React.Dispatch<React.SetStateAction<WorkoutDataType[]>>
}

const WorkoutListItem = ({ workout, setWorkoutList }: WorkoutListItemProps) => {
  const [exerciseList, setExerciseList] = useState(workout.exercises)
  const [isEditing, setIsEditing] = useState(false)

  const handleUpdateExercise = (
    exerciseID: string,
    updatedExerciseStr: string,
    originalExerciseStr: string
  ) => {
    const currExercise = workout.exercises.find(ex => ex.id === exerciseID)
    if (currExercise?.originalString !== updatedExerciseStr)
      if (currExercise) {
        const parsedExercise = parseExercise(updatedExerciseStr, exerciseID)
        const originalExerciseName = parseExercise(originalExerciseStr).name
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

  const handleEditWorkout = () => {}

  const handleRemoveExercise = (exerciseID: string) => {
    setExerciseList(prev => prev.filter(ex => ex.id !== exerciseID))
  }

  const handleSaveWorkout = () => {
    // const newExercises: ExerciseDataType[] = []
    // const removedExerciseIDs: string[] = []

    const origIDs = workout.exercises.map(ex => ex.id)
    const updatedIDs: string[] = []
    exerciseList.forEach(ex => {
      if (ex.originalString) {
        updatedIDs.push(ex.id)
      }
    })
    const newExercises = exerciseList.filter(
      currEx => !origIDs.includes(currEx.id)
    )
    const removedExercises = workout.exercises.filter(
      origEx => !updatedIDs.includes(origEx.id)
    )

    console.log(newExercises, removedExercises)

    addAndRemoveExercisesFromWorkout(
      workout.id,
      workout.date,
      exerciseList,
      newExercises,
      removedExercises
    )
  }

  const handleAddExercise = () => {
    const newExercise: ExerciseDataType = {
      ...generateNewExercise(),
      originalString: '',
      name: '',
      weights: [],
    }
    setExerciseList(prev => [...prev, newExercise])
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
                text: 'Edit',
                icon: <BiEdit className='icon' />,
                type: 'default',
                action: () => setIsEditing(true),
              },
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
      <div className={`exercise-list ${isEditing ? 'editing-list' : ''}`}>
        {exerciseList.map(exercise => {
          return (
            <ExerciseItem
              key={exercise.id}
              exercise={exercise}
              handleUpdateExercise={handleUpdateExercise}
              isEditing={isEditing}
              handleRemoveExercise={handleRemoveExercise}
            />
          )
        })}
      </div>
      {isEditing && (
        <>
          <button
            className='btn-no-styles add-exercise-btn'
            onClick={handleAddExercise}
          >
            <AiOutlinePlusCircle className='icon' /> Add Exercise
          </button>
          <div className='editing-options'>
            <button className='btn-no-styles cancel'>cancel</button>
            <button className='btn-no-styles save' onClick={handleSaveWorkout}>
              save
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default WorkoutListItem
