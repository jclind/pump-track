import React from 'react'
import Modal from 'react-modal'
import QRCode from 'react-qr-code'
import styles from '../../_exports.module.scss'
import './FriendQRModal.scss'

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    background: styles.primaryBackground,
    borderRadius: '5px',
    maxWidth: '80%',
    maxHeight: '80%',
  },
  overlay: {
    zIndex: '1000',
    background: 'rgba(0, 0, 0, 0.5)',
  },
}

type FriendQRModalProps = {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  name: string
  username: string
}
const FriendQRModal = ({
  isOpen,
  setIsOpen,
  name,
  username,
}: FriendQRModalProps) => {
  const closeModal = () => {
    setIsOpen(false)
  }

  const url = `${window.location.origin}/user/${username}`
  return (
    <Modal isOpen={isOpen} onRequestClose={closeModal} style={customStyles}>
      <div className='friend-qr-modal'>
        <div className='user-data'>
          <div className='name'>{name}</div>
          <h4 className='username'>@{username}</h4>
        </div>
        <div className='qr-code-container'>
          <QRCode
            value={url}
            fgColor={styles.secondaryBackground}
            className='qr'
            level='L'
            bgColor={styles.primaryText}
          />
          <div className='text'>Pump track</div>
        </div>
      </div>
    </Modal>
  )
}

export default FriendQRModal
