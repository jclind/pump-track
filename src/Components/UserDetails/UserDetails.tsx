import React, { useState } from 'react'
import './UserDetails.scss'
import { AiOutlineQrcode, AiOutlineUser } from 'react-icons/ai'

import { UserProfileDataType } from '../../types'
import FriendQRModal from '../FriendQRModal/FriendQRModal'
import styles from '../../_exports.module.scss'
import Skeleton from '@mui/material/Skeleton'
import { useNavigate } from 'react-router-dom'

type UserDetailsProps = {
  userData: UserProfileDataType | null
  numFriends: number | null
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  currUserIsAuthor: boolean | null
}

const UserDetails = ({
  userData,
  numFriends,
  loading,
  currUserIsAuthor,
}: UserDetailsProps) => {
  const [isFriendQRModalOpen, setIsFriendQRModalOpen] = useState(false)

  const navigate = useNavigate()

  return (
    <div className='user-details'>
      <button
        className='btn-no-styles profile-image-container'
        onClick={() => setIsFriendQRModalOpen(true)}
        disabled={loading}
      >
        {!userData || loading ? (
          <Skeleton
            sx={{ bgcolor: styles.tertiaryBackground, flexShrink: 0 }}
            variant='circular'
            width={100}
            height={100}
          />
        ) : userData.photoUrl ? (
          <img
            src={userData.photoUrl}
            alt={userData.displayName || 'profile'}
            className='profile-image'
          />
        ) : (
          <div className='profile-image'>
            <AiOutlineUser className='icon' />
          </div>
        )}
        {!userData || loading ? (
          <Skeleton
            sx={{
              bgcolor: styles.tertiaryText,
              flexShrink: 0,
              position: 'absolute',
              bottom: 0,
              right: 0,
            }}
            variant='circular'
            width={40}
            height={40}
          />
        ) : (
          <div className='qr-code-link'>
            <AiOutlineQrcode className='icon' />
          </div>
        )}
      </button>
      <h3 className='display-name'>
        {!userData || loading ? (
          <Skeleton
            sx={{
              bgcolor: styles.tertiaryBackground,
            }}
            variant='rounded'
            width={120}
            height={18}
          />
        ) : (
          userData.displayName
        )}
      </h3>
      <div className='username'>
        {!userData || loading ? (
          <Skeleton
            sx={{
              bgcolor: styles.tertiaryBackground,
            }}
            variant='rounded'
            width={140}
            height={15}
          />
        ) : (
          `@${userData.username}`
        )}
      </div>
      <div className='small-data'>
        <button
          className='item btn-no-styles'
          disabled={!currUserIsAuthor || loading}
          onClick={() => navigate(`friends`)}
        >
          <div className='value'>
            {!userData || loading ? (
              <Skeleton
                sx={{
                  bgcolor: styles.tertiaryBackground,
                }}
                variant='rounded'
                width={20}
                height={22}
              />
            ) : (
              numFriends
            )}
          </div>
          <div className='label'>Friends</div>
        </button>
        <div className='item'>
          <div className='value'>
            {!userData || loading ? (
              <Skeleton
                sx={{
                  bgcolor: styles.tertiaryBackground,
                }}
                variant='rounded'
                width={20}
                height={22}
              />
            ) : (
              userData.totalWorkouts
            )}
          </div>
          <div className='label'>Workouts</div>
        </div>
      </div>
      {userData && !loading ? (
        <FriendQRModal
          isOpen={isFriendQRModalOpen}
          setIsOpen={setIsFriendQRModalOpen}
          name={userData.displayName}
          username={userData.username}
        />
      ) : null}
    </div>
  )
}

export default UserDetails
