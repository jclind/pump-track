import React from 'react'
import './FriendStatusButton.scss'
import { FriendsStatusType } from '../../types'
import {
  acceptFriendRequest,
  addFriend,
  cancelFriendRequest,
} from '../../services/friends'
import toast from 'react-hot-toast'

const getBtnText = (friendshipStatus: FriendsStatusType): string => {
  if (friendshipStatus === 'not_friends') return 'add friend'
  else if (friendshipStatus === 'outgoing') return 'requested'
  else if (friendshipStatus === 'incoming') return 'accept request'
  return friendshipStatus
}

type FriendStatusButtonProps = {
  friendshipStatus: FriendsStatusType
  setFriendshipStatus: React.Dispatch<
    React.SetStateAction<FriendsStatusType | null>
  >
  accountUsername: string
}
const FriendStatusButton = ({
  friendshipStatus,
  setFriendshipStatus,
  accountUsername,
}: FriendStatusButtonProps) => {
  const handleClick = () => {
    if (friendshipStatus === 'not_friends') {
      setFriendshipStatus('outgoing')
      addFriend(accountUsername).catch((err: any) => {
        toast.error(err, { position: 'bottom-center' })
        setFriendshipStatus('not_friends')
      })
    } else if (friendshipStatus === 'outgoing') {
      setFriendshipStatus('not_friends')
      cancelFriendRequest(accountUsername).catch((err: any) => {
        toast.error(err, { position: 'bottom-center' })
        setFriendshipStatus('outgoing')
      })
    } else if (friendshipStatus === 'incoming') {
      setFriendshipStatus('friends')
      acceptFriendRequest(accountUsername).catch((err: any) => {
        toast.error(err, { position: 'bottom-center' })
        setFriendshipStatus('incoming')
      })
    }
  }

  return (
    <button
      className={`add-friend-btn submit-btn ${friendshipStatus}`}
      onClick={handleClick}
    >
      {getBtnText(friendshipStatus)}
    </button>
  )
}

export default FriendStatusButton
