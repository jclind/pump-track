import React, { useEffect, useState } from 'react'
import ExerciseList from '../ExerciseList/ExerciseList'
import WorkoutList from '../WorkoutList/WorkoutList'
import Footer from '../Footer/Footer'
import { User } from 'firebase/auth'
import { WorkoutDataType } from '../../types'

type HomeProps = {
  user: User
  setShowLoadingOverlay: React.Dispatch<React.SetStateAction<boolean>>
}

const Home = ({ user, setShowLoadingOverlay }: HomeProps) => {
  const [exerciseListLoading, setExerciseListLoading] = useState(true)
  const [workoutListLoading, setWorkoutListLoading] = useState(true)
  const [workoutList, setWorkoutList] = useState<WorkoutDataType[]>([])

  const [currWorkoutTitle, setCurrWorkoutTitle] = useState('')

  useEffect(() => {
    if (!user && (exerciseListLoading || workoutListLoading)) {
      setShowLoadingOverlay(true)
    } else {
      setTimeout(() => {
        setShowLoadingOverlay(false)
      }, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, exerciseListLoading, workoutListLoading])
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
