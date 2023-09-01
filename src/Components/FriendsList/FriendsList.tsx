import React, { useState, useEffect } from 'react'
import './FriendsList.scss'
import {
  addFriend,
  getPendingFriendRequests,
  getSuggestedFriends,
  removePendingRequest,
} from '../../services/friends'
import {
  CombinedRequestedFriendDataType,
  UserProfileDataType,
} from '../../types'
import toast from 'react-hot-toast'
import Skeleton from '@mui/material/Skeleton'
import styles from '../../_exports.scss'
import { Link } from 'react-router-dom'

// type PendingFriendRequestProps = {
//   request: CombinedRequestedFriendDataType
// }

// const PendingFriendRequest = ({ request }: PendingFriendRequestProps) => {
//   const [accepted, setAccepted] = useState(false)

//   const { displayName, photoUrl, username } = request

//   const handleAcceptRequest = () => {
//     setAccepted(true)
//     acceptFriendRequest(username).catch((err: any) => {
//       toast.error(err, { position: 'bottom-center' })
//       setAccepted(false)
//     })
//   }
//   return (
//     <div className='friend-request'>
//       <div className='profile-picture-container'>
//         <img src={photoUrl} alt={displayName} />
//       </div>
//       <div className='display-name'>{displayName}</div>
//       <div className='username'>@{username}</div>
//       <button
//         className={`accept-request-btn btn-no-styles ${
//           accepted ? 'accepted' : ''
//         }`}
//         disabled={accepted}
//         onClick={handleAcceptRequest}
//       >
//         {accepted ? 'Accepted' : 'Accept'}
//       </button>
//     </div>
//   )
// }
type SuggestedFriendProps = {
  friendData?: UserProfileDataType | null
  loading?: boolean
}
const SuggestedFriend = ({
  friendData = null,
  loading = false,
}: SuggestedFriendProps) => {
  const [requested, setRequested] = useState(false)

  const { displayName, photoUrl, username } = friendData ?? {}

  const handleRequestFriend = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault()
    if (username) {
      if (!requested) {
        setRequested(true)
        addFriend(username).catch((err: any) => {
          toast.error(err, { position: 'bottom-center' })
          setRequested(false)
        })
      } else {
        setRequested(false)
        removePendingRequest(username).catch((err: any) => {
          toast.error(err, { position: 'bottom-center' })
          setRequested(true)
        })
      }
    }
  }

  return (
    <Link
      className='suggested-friend'
      to={loading ? '#' : `../user/${username}`}
    >
      <div className='profile-picture-container'>
        {loading ? (
          <Skeleton
            sx={{ bgcolor: styles.tertiaryBackground }}
            variant='circular'
            width={40}
            height={40}
          />
        ) : (
          <img src={photoUrl} alt={displayName} />
        )}
      </div>
      {loading ? (
        <Skeleton
          sx={{ bgcolor: styles.tertiaryBackground }}
          variant='text'
          className='display-name'
        />
      ) : (
        <div className='display-name'>{displayName}</div>
      )}
      {loading ? (
        <Skeleton
          sx={{ bgcolor: styles.tertiaryBackground }}
          variant='text'
          className='request-btn'
        />
      ) : (
        <button
          className={`request-btn btn-no-styles ${
            requested ? 'requested' : ''
          }`}
          disabled={loading}
          onClick={handleRequestFriend}
        >
          {requested ? 'Requested' : 'Add'}
        </button>
      )}
    </Link>
  )
}

const FriendsList = () => {
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    CombinedRequestedFriendDataType[]
  >([])
  const [suggestedFriendList, setSuggestedFriendList] = useState<
    UserProfileDataType[]
  >([])
  const [suggestedLoading, setSuggestedLoading] = useState(true)
  const [isSuggestedData, setIsSuggestedData] = useState(true)

  useEffect(() => {
    getPendingFriendRequests()
      .then(res => {
        if (res) {
          setPendingFriendRequests(res)
          console.log(pendingFriendRequests)
        } else {
          setPendingFriendRequests([])
        }
      })
      .catch((err: any) => {
        toast.error(err, { position: 'bottom-center' })
      })
    // getFriends({ returnUserData: true }).then(res => {
    //   if (res) {
    //     // !!! fix
    //     setFriendsList([])
    //   }
    // })
    setSuggestedLoading(true)
    getSuggestedFriends()
      .then(res => {
        if (res) {
          setSuggestedFriendList(res || [])
        } else {
          setIsSuggestedData(false)
        }
        setSuggestedLoading(false)
      })
      .catch(err => {
        setSuggestedLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className='friends-container'>
      {/* <div className='pending-friend-request-list'>
        <div className='account-header'>Friend Requests</div>
        {pendingFriendRequests.map(req => {
          return <PendingFriendRequest key={req.friendUID} request={req} />
        })}
      </div> */}
      {/* <div className='friends-list'>
        {friendsList.map(friend => {
          const { photoUrl, displayName, username } = friend
          return (
            <div className='friend-request' key={friend.friendUID}>
              <div className='profile-picture-container'>
                <img src={photoUrl} alt={displayName} />
              </div>
              <div className='display-name'>{displayName}</div>
              <div className='username'>@{username}</div>
            </div>
          )
        })}
      </div> */}
      <div className='suggested-friends-container'>
        <div className='account-header'>Suggested Friends</div>
        <div className='suggested-friends-list'>
          {isSuggestedData ? (
            suggestedLoading ? (
              <>
                <SuggestedFriend loading={true} />
                <SuggestedFriend loading={true} />
                <SuggestedFriend loading={true} />
              </>
            ) : (
              suggestedFriendList.map(friend => {
                return (
                  <React.Fragment key={friend.username}>
                    <SuggestedFriend friendData={friend} />
                  </React.Fragment>
                )
              })
            )
          ) : (
            <h5>No Suggested Friends Right Now</h5>
          )}
        </div>
      </div>
    </div>
  )
}

export default FriendsList
