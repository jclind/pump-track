import React, { useState } from 'react'
import { AiFillInfoCircle } from 'react-icons/ai'
import Modal from 'react-modal'
import './InfoModal.scss'

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
  },
  overlay: {
    zIndex: '1000',
    background: 'rgba(0, 0, 0, 0.5)',
  },
}

const InfoModal = () => {
  const [isOpen, setIsOpen] = useState(false)

  const [showExamples, setShowExamples] = useState(false)

  const closeModal = () => {
    setIsOpen(false)
  }

  return (
    <>
      <button
        className='info-btn btn-no-styles'
        onClick={() => setIsOpen(true)}
        aria-label='How to enter exercises'
      >
        <AiFillInfoCircle className='icon' />
      </button>
      <Modal
        isOpen={isOpen}
        // onAfterOpen={afterOpenModal}
        onRequestClose={closeModal}
        style={customStyles}
        // contentLabel='Example Modal'
      >
        <div className='content'>
          <h3>Inputting Exercise Data</h3>
          <p>Multiple weight groups can be divided by slashes.</p>
          <p>Sets with differing reps can be separated by commas.</p>
          <div className='documentation-container'>
            <ul>
              <li>(name) (weight) (sets)x(reps)</li>
              <li>(name) (weight) (reps), (reps)</li>
              <li>(name) (weight) (reps), (sets)x(reps)</li>
              <li>(name) (weight) (sets)x(reps) / (weight) (sets)x(reps)</li>
            </ul>
          </div>

          <div
            className={`examples-container ${showExamples ? 'show' : 'hide'}`}
          >
            {/* <span className='comment'>&#47;&#47; Examples</span> */}
            <ul>
              <li>
                Deadlift 100 3x8{' '}
                <span className='comment'>
                  &#47;&#47; 100 lbs, 3 sets of 8 reps
                </span>
              </li>
              <li>
                Smith Bench 100 3x8 / 50 20{' '}
                <span className='comment'>
                  &#47;&#47; 100 lbs, 3 sets of 8 reps, then 50 lbs 1 set of 20
                  reps
                </span>
              </li>
              <li>
                Cable Bicep Curl 85 12, 10, 8, 6{' '}
                <span className='comment'>
                  &#47;&#47; 85 lbs, 4 sets with 12, 10, 8, and 6 reps
                  respectively
                </span>
              </li>
            </ul>
          </div>
          <div className='btn-container'>
            <button
              className='show-examples-btn btn-no-styles'
              onClick={() => setShowExamples(prev => !prev)}
            >
              {showExamples ? 'Hide Examples' : 'Show Examples'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default InfoModal
