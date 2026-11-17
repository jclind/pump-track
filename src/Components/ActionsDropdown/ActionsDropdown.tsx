import React, { useEffect, useRef, useState } from 'react'
import { AiOutlineEllipsis } from 'react-icons/ai'

import './ActionsDropdown.scss'

const useOutsideAlerter = (
  ref: React.RefObject<HTMLDivElement | null>,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
) => {
  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: any) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}

type ActionsDropdownProps = {
  buttons: {
    text: string
    icon: React.JSX.Element
    type?: 'default' | 'danger'
    // Ask for a second tap, Cancel or Confirm, before running the action.
    confirm?: boolean
    action: () => void
  }[]
}

const ActionsDropdown = ({ buttons }: ActionsDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  useOutsideAlerter(wrapperRef, setIsOpen)

  const toggleOpen = () => {
    setIsOpen(prev => !prev)
    setConfirming(null)
  }

  return (
    <div className='actions-dropdown-container'>
      <button
        className='trigger btn-no-styles'
        aria-label='Actions'
        onClick={toggleOpen}
      >
        <AiOutlineEllipsis className='icon' />
      </button>
      {isOpen && (
        <div className='dropdown' ref={wrapperRef}>
          {buttons.map(item => {
            if (confirming === item.text) {
              return (
                <div className='confirm' key={item.text}>
                  <button
                    className='item btn-no-styles'
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className={`item btn-no-styles ${item.type ? item.type : ''}`}
                    onClick={() => {
                      setConfirming(null)
                      setIsOpen(false)
                      item.action()
                    }}
                  >
                    Confirm
                  </button>
                </div>
              )
            }
            return (
              <button
                key={item.text}
                className={`item btn-no-styles ${item.type ? item.type : ''}`}
                onClick={() => {
                  if (item.confirm) setConfirming(item.text)
                  else item.action()
                }}
              >
                {item.icon}
                <div className='text'>{item.text}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ActionsDropdown
