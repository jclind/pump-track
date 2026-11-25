import React, { useEffect, useState } from 'react'
import ExerciseList from '../Components/ExerciseList/ExerciseList'
import WorkoutList from '../Components/WorkoutList/WorkoutList'
import Footer from '../Components/Footer/Footer'
import { User } from 'firebase/auth'
import { WorkoutDataType } from '../types'

type HomeProps = {
  user: User
  setShowLoadingOverlay: React.Dispatch<React.SetStateAction<boolean>>
}

const Home = ({ setShowLoadingOverlay }: HomeProps) => {
  const [exerciseListLoading, setExerciseListLoading] = useState(true)
  const [workoutListLoading, setWorkoutListLoading] = useState(true)
  const [workoutList, setWorkoutList] = useState<WorkoutDataType[]>([])

  const [currWorkoutTitle, setCurrWorkoutTitle] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoadingOverlay(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [setShowLoadingOverlay])
  return (
    <>
      <ExerciseList
        setWorkoutList={setWorkoutList}
        loading={exerciseListLoading}
        setLoading={setExerciseListLoading}
        workoutTitle={currWorkoutTitle}
        setWorkoutTitle={setCurrWorkoutTitle}
      />
      <WorkoutList
        workoutList={workoutList}
        setWorkoutList={setWorkoutList}
        loading={workoutListLoading}
        setLoading={setWorkoutListLoading}
        currWorkoutTitle={currWorkoutTitle}
      />
      <Footer setWorkoutList={setWorkoutList} />
    </>
  )
}

export default Home
