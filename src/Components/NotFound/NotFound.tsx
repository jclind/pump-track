import React from 'react'
import { Link } from 'react-router-dom'
import NoDataAnimation from '../NoDataAnimation/NoDataAnimation'
import './NotFound.scss'

type NotFoundProps = {
  title: string
  message: string
}

const NotFound = ({ title, message }: NotFoundProps) => {
  return (
    <div className='friends-no-data not-found'>
      <NoDataAnimation />
      <h2 className='no-data-title'>{title}</h2>
      <p>{message}</p>
      <Link to='/' className='home-link'>
        Back to home
      </Link>
    </div>
  )
}

export default NotFound
