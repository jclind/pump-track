import React, { useEffect, useState } from 'react'
import './Friends.scss'
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import FriendsList from '../../Components/FriendsPage/FriendsList/FriendsList'
import { getNumIncoming, getNumberOfFriends } from '../../services/friends'
import { getUsername } from '../../services/auth'

type ContextType = {
  setNumIncoming: React.Dispatch<React.SetStateAction<number | null>>
  setNumFriends: React.Dispatch<React.SetStateAction<number | null>>
}

export function useFriendsContext() {
  return useOutletContext<ContextType>()
}

const Friends = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const pathParts = location.pathname.split('/')
  const endPath = pathParts[pathParts.length - 1]

  const [numIncoming, setNumIncoming] = useState<number | null>(null)
  const [numFriends, setNumFriends] = useState<number | null>(null)

  const [currUsername, setCurrUsername] = useState<string | null>(null)

  useEffect(() => {
    getUsername().then(res => setCurrUsername(res || null))
  }, [])
  useEffect(() => {
    if (currUsername) {
      if (!location.pathname.includes(`/user/${currUsername}/friends`)) {
        navigate('/')
      } else {
        getNumIncoming().then(res => {
          setNumIncoming(res ?? null)
        })
        getNumberOfFriends().then(res => {
          setNumFriends(res ?? null)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currUsername])

  return (
    <div className='friends-page'>
      <div className='title'>Friends page</div>
      <div className='page-options'>
        <Link
          to='incoming'
          className={`link ${endPath === 'incoming' ? 'active' : ''}`}
        >
          Requests {numIncoming ? `(${numIncoming})` : ''}
        </Link>
        <Link to='' className={`link ${endPath === 'friends' ? 'active' : ''}`}>
          Friends {numFriends ? `(${numFriends})` : ''}
        </Link>
        <Link
          to='outgoing'
          className={`link ${endPath === 'outgoing' ? 'active' : ''}`}
        >
          Pending
        </Link>
        <div className={`selected-indicator ${endPath}`}>
          <div className='inner'></div>
        </div>
      </div>
      {location.pathname === `/user/${currUsername}/friends` ? (
        <FriendsList setNumFriends={setNumFriends} />
      ) : (
        <Outlet
          context={{ setNumIncoming, setNumFriends } satisfies ContextType}
        />
      )}
    </div>
  )
}

export default Friends
