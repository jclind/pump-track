import React, { useEffect, useState } from 'react'
import './Nav.scss'
import { getUsername, logout } from '../../services/auth'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  AiOutlineHome,
  AiOutlineLineChart,
  AiOutlineUser,
} from 'react-icons/ai'

const Nav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const currPage = location.pathname.split('/').pop()
  const [username, setUsername] = useState('')
  // The signed-in user's own profile and friends pages count as the account
  // tab. Other people's profiles don't.
  const onOwnProfile =
    !!username &&
    (location.pathname === `/user/${username}` ||
      location.pathname.startsWith(`/user/${username}/`))

  useEffect(() => {
    getUsername()
      .then(res => {
        setUsername(res || '')
      })
      .catch((error: any) => {
        toast.error(error?.message || String(error), {
          position: 'bottom-center',
        })
      })
  }, [])

  const handleLogout = () => {
    logout().then(() => {
      navigate('/')
    })
  }

  return (
    <nav>
      <div className='links'>
        <button
          className={`btn-no-styles home-btn ${
            currPage === '' ? 'active' : ''
          }`}
          onClick={() => navigate('/')}
          aria-label='Home'
          aria-current={currPage === '' ? 'page' : undefined}
        >
          <AiOutlineHome className='icon' />
        </button>
        <button
          className={`btn-no-styles account-btn ${
            onOwnProfile ? 'active' : ''
          }`}
          // Until the lookup returns, the link would be /user/, which no route
          // matches, and a refresh there stays blank.
          disabled={!username}
          onClick={() => navigate(`/user/${username}`)}
          aria-label='Your profile'
          aria-current={onOwnProfile ? 'page' : undefined}
        >
          <AiOutlineUser className='icon' />
        </button>
        <button
          className={`btn-no-styles exercise-charts-btn ${
            currPage === 'charts' ? 'active' : ''
          }`}
          onClick={() => navigate('/charts')}
          aria-label='Charts'
          aria-current={currPage === 'charts' ? 'page' : undefined}
        >
          <AiOutlineLineChart className='icon' />
        </button>
      </div>
      <button className='btn-no-styles logout-btn' onClick={handleLogout}>
        Logout
      </button>
    </nav>
  )
}

export default Nav
