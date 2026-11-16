import React, { useState, useEffect } from 'react'
import './Account.scss'
import UserDetails from '../../Components/UserDetails/UserDetails'
import { useParams } from 'react-router-dom'
import { getUserData, getUsername } from '../../services/auth'
import { FriendsStatusType, UserProfileDataType } from '../../types'
import toast from 'react-hot-toast'
import FriendsList from '../../Components/FriendsList/FriendsList'
import { getFriendshipStatus, getNumberOfFriends } from '../../services/friends'
import FriendStatusButton from '../../Components/FriendStatusButton/FriendStatusButton'
import LastWorkout from '../../Components/LastWorkout/LastWorkout'
import NotFound from '../../Components/NotFound/NotFound'

const Account = () => {
  const [userData, setUserData] = useState<UserProfileDataType | null>(null)
  const [numFriends, setNumFriends] = useState<number | null>(null)
  const [currUserIsAuthor, setCurrUserIsAuthor] = useState<boolean | null>(null)
  const [friendshipStatus, setFriendshipStatus] =
    useState<FriendsStatusType | null>(null)
  const [userDetailsLoading, setUserDetailsLoading] = useState(true)
  const [userNotFound, setUserNotFound] = useState(false)
  const { username } = useParams()

  const checkCurrUserIsAuthor = async (username: string) => {
    const currUsername = await getUsername()
    setCurrUserIsAuthor(currUsername === username)
  }

  const getUserDetails = async (username: string) => {
    const p1 = getUserData(username)
      .then(res => {
        setUserData(res)
        setUserNotFound(!res)
      })
      .catch((error: any) => {
        toast.error(error?.message || String(error), {
          position: 'bottom-center',
        })
      })
    const p2 = getNumberOfFriends(username).then(res => {
      setNumFriends(res || 0)
    })
    const p3 = checkCurrUserIsAuthor(username)
    await Promise.all([p1, p2, p3])
  }
  useEffect(() => {
    if (username) {
      getUserDetails(username).then(() => setUserDetailsLoading(false))
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  useEffect(() => {
    if (currUserIsAuthor === false && username && !userNotFound) {
      getFriendshipStatus(username).then(res => {
        if (res) {
          setFriendshipStatus(res)
        } else {
          setFriendshipStatus('not_friends')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currUserIsAuthor, userNotFound])

  if (!username) return null

  if (userNotFound) {
    return (
      <div className='account-page'>
        <NotFound
          title='User not found'
          message={`No one here goes by @${username}.`}
        />
      </div>
    )
  }

  return (
    <div className='account-page'>
      <UserDetails
        userData={userData}
        loading={userDetailsLoading}
        numFriends={numFriends}
        currUserIsAuthor={currUserIsAuthor}
      />
      {currUserIsAuthor && <LastWorkout />}
      {currUserIsAuthor === false &&
        friendshipStatus &&
        friendshipStatus !== 'friends' && (
          <FriendStatusButton
            friendshipStatus={friendshipStatus}
            setFriendshipStatus={setFriendshipStatus}
            accountUsername={username}
          />
        )}

      {currUserIsAuthor && <FriendsList />}
    </div>
  )
}

export default Account
