import React, { useEffect, useState } from 'react'
import Modal from 'react-modal'
import './ViewAllExercisesModal.scss'
import { ExercisesServerDataType } from '../../types'
import { queryAllSingleExercise } from '../../services/tracker'
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { getDataFromExercise } from '../../util/getDataFromExercise'
import { formatDateToString } from '../../util/dateUtil'
import { toast } from 'react-hot-toast'
import { errorMessage } from '../../util/errorMessage'
import { TailSpin } from 'react-loader-spinner'
import ExercisePR from '../ExercisePR/ExercisePR'

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    background: '#09090b',
    borderRadius: '5px',
    maxWidth: '80%',
    maxHeight: '80%',
  },
  overlay: {
    zIndex: '1000',
    background: 'rgba(0, 0, 0, 0.5)',
  },
}

type ViewAllExercisesModalProps = {
  exerciseName: string
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const ViewAllExercisesModal = ({
  exerciseName,
  isOpen,
  setIsOpen,
}: ViewAllExercisesModalProps) => {
  const [data, setData] = useState<ExercisesServerDataType[]>([])
  const [isMoreData, setIsMoreData] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)

  const [lastQueryDoc, setLastQueryDoc] = useState<QueryDocumentSnapshot<
    DocumentData,
    DocumentData
  > | null>(null)

  useEffect(() => {
    getNextExercises()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getNextExercises = () => {
    if (exerciseName) {
      setMoreLoading(true)
      queryAllSingleExercise(exerciseName, 5, lastQueryDoc)
        .then(res => {
          if (res) {
            const updatedExercises = [...data, ...res.data]
            setLastQueryDoc(res.lastDoc)
            setData(updatedExercises)
            setIsMoreData(res.totalResults > updatedExercises.length)
          }
          setMoreLoading(false)
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error))
          setMoreLoading(false)
        })
    }
  }

  const closeModal = () => {
    setIsOpen(false)
  }

  return (
    <Modal isOpen={isOpen} onRequestClose={closeModal} style={customStyles}>
      <div className='view-all-exercises-content'>
        <h3>Previous {exerciseName} Data</h3>
        <ExercisePR exerciseName={exerciseName} />
        <div className='data'>
          {data.map(exercise => {
            const date = exercise.workoutDate
            const comment =
              exercise.weights[exercise.weights.length - 1].comment
            return (
              <div key={exercise.id} className='single-exercise'>
                <h4>{getDataFromExercise(exercise)}</h4>
                <div className='footer-data'>
                  <span className='date'>
                    {date && formatDateToString(date)}
                  </span>
                  {comment && (
                    <span className='comment'>
                      <span className='dark-text'>(</span>
                      <span className='inner'>{comment}</span>
                      <span className='dark-text'>)</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {isMoreData && (
            <button
              className='btn-no-styles load-more'
              disabled={moreLoading}
              onClick={getNextExercises}
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
    </Modal>
  )
}

export default ViewAllExercisesModal
