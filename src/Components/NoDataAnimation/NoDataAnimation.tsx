import React from 'react'
import { Lottie } from 'lottie-react'
import noDataAnimationJSON2 from '../../assets/animations/no-data-animation-2.json'
import './NoDataAnimation.scss'

const NoDataAnimation = () => {
  return (
    <div className='no-data-animation-container'>
      <div className='animation'>
        <Lottie src={noDataAnimationJSON2} autoplay loop />
      </div>
    </div>
  )
}

export default NoDataAnimation
