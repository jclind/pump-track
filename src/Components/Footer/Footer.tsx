import React, { useState } from 'react'
import Modal from 'react-modal'
import './Footer.scss'
import { parseImportText } from '../../util/parseImportText'
import { errorMessage } from '../../util/errorMessage'
import { WorkoutDataType } from '../../types'
import { importWorkouts } from '../../services/tracker'
import { TailSpin } from 'react-loader-spinner'
import { toast } from 'react-hot-toast'
import packageJSON from '../../../package.json'

const version = packageJSON.version
const build = [__BUILD_COMMIT__, __BUILD_BRANCH__].filter(Boolean).join(' on ')

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
    width: '400px',
    maxWidth: '80%',
  },
  overlay: {
    zIndex: '1000',
    background: 'rgba(0, 0, 0, 0.5)',
  },
}

type FooterProps = {
  setWorkoutList: React.Dispatch<React.SetStateAction<WorkoutDataType[]>>
}

const Footer = ({ setWorkoutList }: FooterProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [importedText, setImportedText] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleImport = () => {
    const { workouts: parsedWorkouts, untitled } = parseImportText(importedText)
    if (parsedWorkouts.length === 0) {
      toast.error('No workouts found. Start each one with a title line.', {
        position: 'bottom-center',
      })
      return
    }

    setImportLoading(true)
    importWorkouts(parsedWorkouts)
      .then(workouts => {
        const skipped = untitled
          ? `, skipped ${untitled} without a title`
          : ''
        const plural = workouts.length === 1 ? '' : 's'
        toast.success(`Imported ${workouts.length} workout${plural}${skipped}`, {
          position: 'bottom-center',
        })
        setIsModalOpen(false)
        setImportedText('')

        setWorkoutList(prev => {
          const combinedWorkouts: WorkoutDataType[] = [...prev, ...workouts]
          const workoutsWithDate = combinedWorkouts
            .filter(workout => workout.date !== null)
            .sort((a, b) => b.date! - a.date!)
          return [
            ...workoutsWithDate,
            ...combinedWorkouts.filter(workout => workout.date === null),
          ]
        })
      })
      .catch((error: unknown) => {
        console.log(error)
        toast.error(`Import failed: ${errorMessage(error)}`, {
          position: 'bottom-center',
        })
      })
      .finally(() => setImportLoading(false))
  }

  return (
    <footer className='footer'>
      <div className='actions'>
        <button
          className='btn-no-styles import-btn'
          onClick={() => setIsModalOpen(true)}
        >
          import workouts
        </button>
        <a
          href='https://www.buymeacoffee.com/jesseclind'
          target='_blank'
          rel='noopener noreferrer'
          className='btn-no-styles donate-btn'
        >
          donate
        </a>
      </div>
      <div className='copyright'>
        © {new Date().getFullYear()} || Made with React.js
      </div>
      <div className='version'>
        version {version}
        {build && `, build ${build}`}
      </div>
      <Modal
        isOpen={isModalOpen}
        // onAfterOpen={afterOpenModal}
        onRequestClose={closeModal}
        style={customStyles}
        // contentLabel='Example Modal'
      >
        <div className='import-modal-content'>
          <h3>Import Your Workout Data</h3>
          <textarea
            className='import-input'
            value={importedText}
            onChange={e => setImportedText(e.target.value)}
          ></textarea>
          <button
            className='submit-btn'
            onClick={handleImport}
            disabled={importLoading}
          >
            {importLoading ? (
              <TailSpin
                height='25'
                width='25'
                color='#303841'
                ariaLabel='loading'
              />
            ) : (
              'Import'
            )}
          </button>
        </div>
      </Modal>
    </footer>
  )
}

export default Footer
