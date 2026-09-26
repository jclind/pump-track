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
import { User, House, ChartLine } from 'lucide-react'

const Nav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const currPage = location.pathname.split('/').pop()
  const [username, setUsername] = useState('')

  useEffect(() => {
    getUsername()
      .then(res => {
        setUsername(res || '')
      })
      .catch((error: any) => {
        toast.error(error, { position: 'bottom-center' })
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
        >
          <House className='icon' />
        </button>
        <button
          className={`btn-no-styles account-btn ${
            currPage === 'account' ? 'active' : ''
          }`}
          onClick={() => navigate(`/user/${username}`)}
        >
          <User className='icon' />
        </button>
        <button
          className={`btn-no-styles exercise-charts-btn ${
            currPage === 'charts' ? 'active' : ''
          }`}
          onClick={() => navigate('/charts')}
        >
          <ChartLine className='icon' />
        </button>
      </div>
      <button className='btn-no-styles logout-btn' onClick={handleLogout}>
        Logout
      </button>
    </nav>
  )
}

export default Nav
