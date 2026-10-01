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
    action: () => void
  }[]
}

const ActionsDropdown = ({ buttons }: ActionsDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  useOutsideAlerter(wrapperRef, setIsOpen)

  return (
    <div className='actions-dropdown-container'>
      <button
        className='trigger btn-no-styles'
        onClick={() => setIsOpen(prev => !prev)}
      >
        <AiOutlineEllipsis className='icon' />
      </button>
      {isOpen && (
        <div className='dropdown' ref={wrapperRef}>
          {buttons.map(item => {
            return (
              <button
                key={item.text}
                className={`item btn-no-styles ${item.type ? item.type : ''}`}
                onClick={item.action}
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
