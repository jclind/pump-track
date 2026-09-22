import React, { useState } from 'react'
import './UserCard.scss'
import { CombinedFriendsData } from '../../../types'
import {
  acceptFriendRequest,
  removeFriend,
  removeIncomingRequest,
  removeOutgoingRequest,
} from '../../../services/friends'
import { TailSpin } from 'react-loader-spinner'
import Skeleton from '@mui/material/Skeleton'
import styles from '../../../_exports.module.scss'
import { Link } from 'react-router-dom'
import { AiOutlineCheck } from 'react-icons/ai'

type UserDataType = CombinedFriendsData | null

type CardTypeProps = {
  user: UserDataType
  loading: boolean
  removeFromList: (uid: string) => void
  setNumIncoming?: React.Dispatch<React.SetStateAction<number | null>>
  setNumFriends?: React.Dispatch<React.SetStateAction<number | null>>
}
const IncomingActions = ({
  user,
  loading,
  removeFromList,
  setNumIncoming,
  setNumFriends,
}: CardTypeProps) => {
  const [isFriends, setIsFriends] = useState(false)
  const [isDenied, setIsDenied] = useState(false)
  const [denyRequestLoading, setDenyRequestLoading] = useState(false)
  const [acceptRequestLoading, setAcceptRequestLoading] = useState(false)

  const handleDenyRequest = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user && setNumIncoming) {
      setDenyRequestLoading(true)
      removeIncomingRequest(user.username).then(() => {
        setIsDenied(true)
        setDenyRequestLoading(false)
        removeFromList(user.friendUID)
        setNumIncoming(prev => (prev ? prev - 1 : 0))
      })
    }
  }
  const handleAcceptRequest = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user && setNumIncoming && setNumFriends) {
      setAcceptRequestLoading(true)
      acceptFriendRequest(user.username).then(() => {
        setAcceptRequestLoading(false)
        setIsFriends(true)
        removeFromList(user.friendUID)
        setNumIncoming(prev => (prev ? prev - 1 : 0))
        setNumFriends(prev => (prev ? prev + 1 : 1))
      })
    }
  }

  const isBtnDisabled =
    loading || denyRequestLoading || acceptRequestLoading || !user

  return (
    <div className={`incoming-actions`}>
      <>
        {isFriends ? (
          <div className='friend-added-successfully'>
            <AiOutlineCheck /> Friend Added
          </div>
        ) : isDenied ? (
          <div className='friend-denied'>
            <AiOutlineCheck /> Friend Denied
          </div>
        ) : (
          <>
            {loading ? (
              <Skeleton
                sx={{ bgcolor: styles.tertiaryBackground }}
                variant='rounded'
                width={55}
                height={26}
              />
            ) : (
              <button
                className='no-styles-btn deny-btn'
                disabled={isBtnDisabled}
                onClick={handleDenyRequest}
              >
                {denyRequestLoading ? (
                  <TailSpin
                    height='22'
                    width='22'
                    color={styles.secondary}
                    ariaLabel='loading'
                  />
                ) : (
                  'Deny'
                )}
              </button>
            )}
            {loading ? (
              <Skeleton
                sx={{ bgcolor: styles.secondary }}
                variant='rounded'
                width={70}
                height={26}
              />
            ) : (
              <button
                className='no-styles-btn accept-btn'
                disabled={isBtnDisabled}
                onClick={handleAcceptRequest}
              >
                {acceptRequestLoading ? (
                  <TailSpin
                    height='22'
                    width='22'
                    color={styles.secondary}
                    ariaLabel='loading'
                  />
                ) : (
                  'Accept'
                )}
              </button>
            )}
          </>
        )}
      </>
    </div>
  )
}

const FriendActions = ({
  user,
  loading,
  removeFromList,
  setNumFriends,
}: CardTypeProps) => {
  const [removeFriendLoading, setRemoveFriendLoading] = useState(false)
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false)

  const [friendRemoved, setFriendRemoved] = useState(false)

  const handleRemoveFriendClick = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user) {
      setIsConfirmRemoveOpen(true)
    }
  }
  const handleCancelConfirm = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user) {
      setIsConfirmRemoveOpen(false)
    }
  }
  const handleRemoveFriend = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user && removeFromList && setNumFriends) {
      setRemoveFriendLoading(true)
      removeFriend(user.friendUID).then(() => {
        setRemoveFriendLoading(false)
        setFriendRemoved(true)
        removeFromList(user.friendUID)
        setNumFriends(prev => (prev ? prev - 1 : 0))
      })
    }
  }

  const isBtnDisabled = loading || removeFriendLoading || !user
  return (
    <div className={`friends-actions`}>
      {loading ? (
        <>
          <Skeleton
            sx={{ bgcolor: styles.tertiaryBackground }}
            variant='rounded'
            width={80}
            height={26}
          />
        </>
      ) : friendRemoved ? (
        <div className='friend-removed-text'>
          <AiOutlineCheck />
          Removed
        </div>
      ) : isConfirmRemoveOpen ? (
        <>
          <button
            className='btn-no-styles cancel-remove-friend-btn'
            onClick={handleCancelConfirm}
            disabled={isBtnDisabled}
          >
            Cancel
          </button>
          <button
            className='btn-no-styles confirm-remove-friend-btn'
            onClick={handleRemoveFriend}
            disabled={isBtnDisabled}
          >
            {removeFriendLoading ? (
              <TailSpin
                height='22'
                width='22'
                color={styles.secondary}
                ariaLabel='loading'
              />
            ) : (
              'Confirm'
            )}
          </button>
        </>
      ) : (
        <button
          className='btn-no-styles remove-btn'
          onClick={handleRemoveFriendClick}
          disabled={isBtnDisabled}
        >
          Remove
        </button>
      )}
    </div>
  )
}

const OutgoingActions = ({ user, loading, removeFromList }: CardTypeProps) => {
  const [removeRequestLoading, setRemoveRequestLoading] = useState(false)

  const [isRemoved, setIsRemoved] = useState(false)

  const isBtnDisabled = loading || !user || removeRequestLoading

  const handleRemoveRequest = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (user) {
      setRemoveRequestLoading(true)

      removeOutgoingRequest(user.friendUID).then(() => {
        setIsRemoved(true)
        removeFromList(user.friendUID)
      })
    }
  }

  return (
    <div className='outgoing-actions'>
      {isRemoved ? (
        <div className='pending-removed'>
          <AiOutlineCheck /> Removed
        </div>
      ) : loading ? (
        <Skeleton
          sx={{ bgcolor: styles.tertiaryBackground }}
          variant='rounded'
          width={80}
          height={26}
        />
      ) : (
        <button
          className='no-styles-btn remove-btn'
          disabled={isBtnDisabled}
          onClick={handleRemoveRequest}
        >
          {removeRequestLoading ? (
            <TailSpin
              height='22'
              width='22'
              color={styles.secondary}
              ariaLabel='loading'
            />
          ) : (
            'Remove'
          )}
        </button>
      )}
    </div>
  )
}

type UserCardProps = {
  user: UserDataType
  type: 'incoming' | 'friend' | 'outgoing'
  removeFromList?: (uid: string) => void
  loading?: boolean
  setNumIncoming?: React.Dispatch<React.SetStateAction<number | null>>
  setNumFriends?: React.Dispatch<React.SetStateAction<number | null>>
}
const UserCard = ({
  user,
  type,
  loading,
  removeFromList,
  setNumIncoming,
  setNumFriends,
}: UserCardProps) => {
  const userLink = user ? `/user/${user.username}` : ''

  const [itemRemoved, setItemRemoved] = useState(false)

  const handleRemoveFromList = (uid: string) => {
    setItemRemoved(true)
    setTimeout(() => {
      if (removeFromList) {
        removeFromList(uid)
      }
    }, 3000)
  }

  return (
    <Link
      to={userLink}
      className={`user-card ${!user ? 'disabled-link' : ''} ${
        itemRemoved ? 'removed' : ''
      }`}
    >
      <div className='profile-picture-container'>
        {loading || !user ? (
          <Skeleton
            sx={{ bgcolor: styles.tertiaryBackground }}
            variant='circular'
            width={'100%'}
            height={'100%'}
          />
        ) : (
          <img src={user.photoUrl} alt={user.displayName} />
        )}
      </div>
      <div className='user-info'>
        <div className='name'>
          {loading || !user ? (
            <Skeleton
              sx={{ bgcolor: styles.tertiaryBackground }}
              variant='rounded'
              width={120}
              height={14}
            />
          ) : (
            user.displayName
          )}
        </div>
        <div className='username'>
          {loading || !user ? (
            <Skeleton
              sx={{ bgcolor: styles.tertiaryBackground }}
              variant='rounded'
              width={120}
              height={10}
            />
          ) : (
            `(@${user.username})`
          )}
        </div>
      </div>
      <div className='actions'>
        {type === 'incoming' ? (
          <IncomingActions
            loading={!!loading}
            user={user}
            removeFromList={handleRemoveFromList}
            setNumIncoming={setNumIncoming}
            setNumFriends={setNumFriends}
          />
        ) : type === 'friend' ? (
          <FriendActions
            loading={!!loading}
            user={user}
            removeFromList={handleRemoveFromList}
            setNumFriends={setNumFriends}
          />
        ) : type === 'outgoing' ? (
          <OutgoingActions
            loading={!!loading}
            user={user}
            removeFromList={handleRemoveFromList}
          />
        ) : (
          ''
        )}
      </div>
    </Link>
  )
}

export default UserCard
