import React, { useEffect, useState } from 'react'
import './FriendsList.scss'
import { getFriends } from '../../../services/friends'
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import UserCard from '../UserCard/UserCard'
import { CombinedFriendsData } from '../../../types'
import NoDataAnimation from '../../NoDataAnimation/NoDataAnimation'
import { TailSpin } from 'react-loader-spinner'

type FriendsListProps = {
  setNumFriends: React.Dispatch<React.SetStateAction<number | null>>
}

const FriendsList = ({ setNumFriends }: FriendsListProps) => {
  const [friends, setFriends] = useState<CombinedFriendsData[]>([])
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<
    DocumentData,
    DocumentData
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMoreData, setIsMoreData] = useState(true)
  const [isMoreLoading, setIsMoreLoading] = useState(false)

  const handleGetFriends = async (
    currLastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
  ) => {
    const res = await getFriends(currLastDoc, { returnUserData: true })
    const updatedFriends = [...friends, ...res.friendsData]
    setLastDoc(res.lastDoc)
    setFriends(updatedFriends)
    // An empty page also ends the list, so a failed load can't loop.
    if (
      res.numFriends <= updatedFriends.length ||
      res.friendsData.length === 0
    ) {
      setIsMoreData(false)
    }
    setLoading(false)
  }

  const handlePaginateFriends = async () => {
    setIsMoreLoading(true)
    await handleGetFriends(lastDoc)
    setIsMoreLoading(false)
  }
  useEffect(() => {
    handleGetFriends(lastDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeFriendFromList = (uid: string) => {
    if (friends) {
      const newFriends = friends?.filter(friend => friend.friendUID !== uid)
      setFriends(newFriends)
      setNumFriends(prev => (prev ? prev - 1 : 0))
    }
  }

  return (
    <div className='friends-list-page'>
      <div className='friends-list'>
        {!isMoreData && friends.length <= 0 ? (
          <div className='friends-no-data'>
            <NoDataAnimation />

            <div className='no-data-title'>No Current Friends</div>
            <p>
              All of your future friends will show up here. Make sure to check
              back later.
            </p>
          </div>
        ) : friends && !loading ? (
          friends.map(user => {
            return (
              <UserCard
                key={user.friendUID}
                user={user}
                type='friend'
                removeFromList={removeFriendFromList}
                setNumFriends={setNumFriends}
              />
            )
          })
        ) : (
          <>
            <UserCard user={null} type='friend' loading={true} />
            <UserCard user={null} type='friend' loading={true} />
            <UserCard user={null} type='friend' loading={true} />
          </>
        )}
        {isMoreData && !loading ? (
          <div className='load-more-btn-container'>
            <button
              className='btn-no-styles load-more'
              onClick={handlePaginateFriends}
              disabled={isMoreLoading}
            >
              {isMoreLoading ? (
                <TailSpin
                  height='25'
                  width='25'
                  color='#303841'
                  ariaLabel='loading'
                />
              ) : (
                'Load More'
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default FriendsList
