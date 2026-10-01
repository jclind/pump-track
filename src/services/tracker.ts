import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  CurrentWorkoutType,
  ExerciseDataType,
  ExercisePRWeightOBJ,
  ExercisesServerDataType,
  WorkoutDataType,
} from '../types'
import { auth, db, firebaseFunctions } from './firestore'
import { v4 as uuidv4 } from 'uuid'
import { parseExercise } from '../util/parseExercise'
import { getTitleAndDate } from '../util/getTitleAndDate'
import { updateUserActivity } from './auth'
import toast from 'react-hot-toast'
import { httpsCallable } from 'firebase/functions'
import { calculateMaxWeight } from '../util/calculateMaxWeight'

export const addWorkout = async (
  name: string,
  exercises: {
    id: string
    text: string
  }[]
): Promise<WorkoutDataType | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      // const promises: Promise<void>[] = []
      const workoutID = uuidv4()
      const parsedExercises: ExerciseDataType[] = exercises.map(ex => {
        return parseExercise(ex.text, ex.id)
      })

      const { title: workoutTitle, date } = getTitleAndDate(name)
      const workoutDate = date || new Date().getTime()

      const userDataRef = doc(db, 'usersData', uid)
      const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
      // const exercisesRef = collection(userDataRef, 'exercises')
      await updateUniqueTitles('workoutTitles', workoutTitle)

      const workoutData: WorkoutDataType = {
        name: workoutTitle,
        date: workoutDate,
        exercises: parsedExercises,
        id: workoutID,
      }

      await setDoc(workoutDocRef, { ...workoutData })

      await addExercises(uid, parsedExercises, workoutID, workoutDate)

      await updateTotalWorkoutsAndExercises(1, parsedExercises.length)
      await updateUserActivity()

      return workoutData
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const importWorkouts = async (
  workouts: WorkoutDataType[]
): Promise<WorkoutDataType[] | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const promises: Promise<void>[] = []

      const userDataRef = doc(db, 'usersData', uid)
      const workoutsRef = collection(userDataRef, 'workouts')

      const workoutTitles: string[] = []

      let numWorkouts = 0
      const numExercises = 0

      workouts.forEach(workout => {
        const workoutID = workout.id
        const workoutDate = workout.date || new Date().getTime()
        const workoutData = { ...workout, name: workout.name.toLowerCase() }

        const workoutsRefDoc = doc(workoutsRef, workoutID)

        workoutTitles.push(workoutData.name)

        promises.push(setDoc(workoutsRefDoc, workoutData))

        numWorkouts++

        promises.push(
          addExercises(uid, workout.exercises, workoutID, workoutDate)
        )
      })
      await updateUniqueTitles('workoutTitles', workoutTitles)
      await Promise.all(promises)
      await updateTotalWorkoutsAndExercises(numWorkouts, numExercises)
      return workouts
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
// Updated all given exercises and adds all exercise names to the updateUniqueTitles funciton
export const addExercises = async (
  uid: string,
  exercises: ExerciseDataType[],
  workoutID: string,
  workoutDate: number
) => {
  if (uid) {
    const userDataRef = doc(db, 'usersData', uid)
    const exercisesRef = collection(userDataRef, 'exercises')

    const promises: Promise<void>[] = []
    const exerciseTitles: string[] = []

    exercises.forEach((exercise, idx) => {
      const { id, name } = exercise
      const exercisesRefDoc = doc(exercisesRef, id)
      const maxWeight = calculateMaxWeight(exercise.weights)
      if (name) {
        exerciseTitles.push(name)
        promises.push(
          setDoc(exercisesRefDoc, {
            ...exercise,
            name: name.toLowerCase(),
            workoutID,
            workoutDate,
            index: idx,
            maxWeight,
          })
        )
      }
    })
    await updateUniqueTitles('exerciseTitles', exerciseTitles)
    await Promise.all(promises)
  }
}
export const deleteWorkout = async (workoutID: string) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
      const exercisesRef = collection(userDataRef, 'exercises')

      await deleteDoc(workoutDocRef)

      const q = query(exercisesRef, where('workoutID', '==', workoutID))
      const exercisesQuerySnapshot = await getDocs(q)
      let numExercises = 0
      exercisesQuerySnapshot.forEach(doc => {
        numExercises--
        deleteDoc(doc.ref)
      })

      await updateTotalWorkoutsAndExercises(-1, numExercises)
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const searchExercises = async (
  queryText: string
): Promise<ExerciseDataType | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const exercisesRef = collection(userDataRef, 'exercises')

      const q = query(
        exercisesRef,
        where('name', '>=', queryText),
        where('name', '<=', queryText + '\uf8ff'),
        orderBy('name'),
        orderBy('workoutDate', 'desc'),
        limit(1)
      )

      const dataArr: ExerciseDataType[] = []
      const querySnapshot = await getDocs(q)
      querySnapshot.forEach(doc => {
        dataArr.push(doc.data() as ExerciseDataType)
      })

      return dataArr[0]
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const getUniqueTitles = async (
  field: 'workoutTitles' | 'exerciseTitles'
): Promise<string[] | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)

      const userDataDoc = await getDoc(userDataRef)
      const titles = userDataDoc.data()?.[field] || null

      if (!titles) return []

      const sortedTitles = Object.keys(titles).sort(function (a, b) {
        return titles[b] - titles[a]
      })
      return sortedTitles
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const queryAllSingleExercise = async (
  exerciseName: string,
  resultsPerPage = 10,
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const exercisesRef = collection(userDataRef, 'exercises')

      let q
      if (lastDoc) {
        q = query(
          exercisesRef,
          where('name', '==', exerciseName.toLowerCase()),
          orderBy('workoutDate', 'desc'),
          startAfter(lastDoc),
          limit(resultsPerPage)
        )
      } else {
        q = query(
          exercisesRef,
          where('name', '==', exerciseName.toLowerCase()),
          orderBy('workoutDate', 'desc'),
          limit(resultsPerPage)
        )
      }
      const countQuery = query(
        exercisesRef,
        where('name', '==', exerciseName.toLowerCase())
      )
      const totalResultsSnapshot = await getCountFromServer(countQuery)
      const totalResults = totalResultsSnapshot.data().count

      const results: ExercisesServerDataType[] = []
      const querySnapshot = await getDocs(q)
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
      querySnapshot.forEach(doc => {
        results.push(doc.data() as ExercisesServerDataType)
      })

      return { data: results, lastDoc: newLastDoc, totalResults }
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const queryChartExerciseData = async (
  exerciseName: string,
  earliestDate: number
): Promise<{ data: ExercisesServerDataType[] } | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const exercisesRef = collection(userDataRef, 'exercises')

      const q = query(
        exercisesRef,
        where('name', '==', exerciseName.toLowerCase()),
        where('workoutDate', '>=', earliestDate),
        orderBy('workoutDate', 'desc'),
        limit(100)
      )

      const results: ExercisesServerDataType[] = []
      const querySnapshot = await getDocs(q)
      querySnapshot.forEach(doc => {
        results.push(doc.data() as ExercisesServerDataType)
      })

      return { data: results }
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const getSingleExercisePR = async (
  exerciseName: string
): Promise<undefined | ExercisePRWeightOBJ> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const exercisesRef = collection(userDataRef, 'exercises')

      const q = query(
        exercisesRef,
        where('name', '==', exerciseName.toLowerCase()),
        orderBy('maxWeight', 'desc'),
        orderBy('workoutDate', 'asc'),
        limit(1)
      )

      const querySnapshot = await getDocs(q)
      let maxWeight: number | null = null
      let workoutDate: number | null = null
      querySnapshot.forEach(doc => {
        const data = doc.data() as ExercisesServerDataType
        maxWeight = data.maxWeight
        workoutDate = data.workoutDate
      })

      return { maxWeight, workoutDate }
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const getWorkouts = async (
  resultsPerPage = 10,
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null,
  workoutNameQuery: string | null
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const workoutsRef = collection(userDataRef, 'workouts')

      let q = query(workoutsRef)
      if (workoutNameQuery) {
        q = query(q, where('name', '==', workoutNameQuery))
      }
      q = query(q, orderBy('date', 'desc'), limit(resultsPerPage))
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const totalResultsSnapshot = await getCountFromServer(workoutsRef)
      const totalResults = totalResultsSnapshot.data().count

      const querySnapshot = await getDocs(q)
      const workouts: WorkoutDataType[] = []
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
      querySnapshot.forEach(doc => {
        const data = doc.data() as WorkoutDataType
        workouts.push(data)
      })

      return { data: workouts, lastDoc: newLastDoc, totalResults }
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const getMostRecentWorkout = async () => {
  try {
    const workoutRes = await getWorkouts(1, null, null)
    const workoutData = workoutRes?.data[0] || null
    return workoutData
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const getNumberOfTotalWorkouts = async (): Promise<
  number | undefined
> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const workoutsRef = collection(userDataRef, 'workouts')
      const totalResultsSnapshot = await getCountFromServer(workoutsRef)
      const totalResults = totalResultsSnapshot.data().count
      return totalResults
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const getNumberOfTotalExercises = async (): Promise<
  number | undefined
> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const exercisesRef = collection(userDataRef, 'exercises')
      const totalResultsSnapshot = await getCountFromServer(exercisesRef)
      const totalResults = totalResultsSnapshot.data().count
      return totalResults
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const updateTotalWorkoutsAndExercises = async (
  numWorkouts: number,
  numExercises: number
) => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const cloudUpdateTotalWorkoutsAndExercises = httpsCallable(
        firebaseFunctions,
        'updateTotalWorkoutsAndExercises'
      )
      cloudUpdateTotalWorkoutsAndExercises({ uid, numWorkouts, numExercises })
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}

export const updateExercise = async (
  exerciseID: string,
  workoutID: string,
  exerciseList: ExerciseDataType[],
  updatedExerciseData: ExerciseDataType,
  originalExerciseName: string
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
      const exerciseDocRef = doc(userDataRef, 'exercises', exerciseID)

      const updatedExerciseList = exerciseList.map(ex => {
        if (ex.id === exerciseID) return updatedExerciseData

        return ex
      })

      await updateDoc(workoutDocRef, {
        exercises: updatedExerciseList,
      })

      await updateDoc(exerciseDocRef, {
        name: updatedExerciseData.name,
        weights: updatedExerciseData.weights,
        originalString: updatedExerciseData.originalString,
      })
      await updateUniqueTitles(
        'exerciseTitles',
        updatedExerciseData.name,
        originalExerciseName
      )
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const updateWorkout = async (
  currWorkoutData: WorkoutDataType,
  updatedData: { name?: string; date?: number }
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const workoutID = currWorkoutData.id
      const userDataRef = doc(db, 'usersData', uid)
      const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
      await updateDoc(workoutDocRef, {
        ...updatedData,
      })
      if (updatedData.name) {
        const addedTitle = updatedData.name
        const removedTitle = currWorkoutData.name
        await updateUniqueTitles('workoutTitles', addedTitle, removedTitle)
      }
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const getCurrentWorkoutData = async () => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)

      const result = await getDoc(userDataRef)
      const data = result.data()?.currentWorkout as CurrentWorkoutType
      return data
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const updateCurrentWorkout = async (
  workoutTitle: string,
  exercises: { id: string; text: string }[]
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)

      const currWorkoutData = { workoutTitle, exercises }

      await setDoc(
        userDataRef,
        { currentWorkout: currWorkoutData },
        { merge: true }
      )
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const modifyData = async () => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const workoutsRef = collection(userDataRef, 'workouts')
      const exercisesRef = collection(userDataRef, 'exercises')

      const exercisesQ = query(exercisesRef)

      const exercisesQuerySnapshot = await getDocs(exercisesQ)

      exercisesQuerySnapshot.forEach(() => {
        // deleteDoc(doc.ref)
      })

      const workoutsQ = query(workoutsRef)

      const workoutsQuerySnapshot = await getDocs(workoutsQ)

      workoutsQuerySnapshot.forEach(() => {
        // deleteDoc(doc.ref)
      })
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const updateUniqueTitles = async (
  field: 'workoutTitles' | 'exerciseTitles',
  addedTitles: string | string[] | null,
  removedTitles: string | string[] | null = null
) => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userDataRef = doc(db, 'usersData', uid)
      const userDataDoc = await getDoc(userDataRef)
      const titlesDocData = userDataDoc.data()
      const titles = titlesDocData?.[field] || {}

      if (addedTitles) {
        if (typeof addedTitles === 'string') {
          const title = addedTitles.toLowerCase().trim()
          // Add workout title the workoutTitles object
          titles[title] = ++titles[title] || 1
        } else {
          addedTitles.forEach(title => {
            titles[title] = ++titles[title] || 1
          })
        }
      }
      if (removedTitles) {
        if (typeof removedTitles === 'string') {
          const title = removedTitles.toLowerCase().trim()
          titles[title] = --titles[title] || 0
        } else {
          removedTitles.forEach(title => {
            titles[title] = --titles[title] || 0
          })
        }
      }
      const filteredTitles: { [key: string]: number } = {}
      for (const [key, value] of Object.entries(titles)) {
        if (typeof value === 'number' && value > 0) {
          filteredTitles[key] = value
        }
      }
      await updateDoc(userDataRef, {
        [field]: filteredTitles,
      })
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const findUniqueWorkoutTitlesFromCollection = async () => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    const userDataRef = doc(db, 'usersData', uid)
    const workoutsRef = collection(userDataRef, 'workouts')
    const workoutsQ = query(workoutsRef)
    const workoutsQuerySnapshot = await getDocs(workoutsQ)
    const workoutTitles: { [key: string]: number } = {}

    workoutsQuerySnapshot.forEach(doc => {
      const workoutData = doc.data() as WorkoutDataType
      const workoutTitle = workoutData.name.toLowerCase().trim()
      workoutTitles[workoutTitle] = ++workoutTitles[workoutTitle] || 1
    })

    updateDoc(userDataRef, {
      workoutTitles,
    })
  }
}
export const findUniqueExerciseTitlesFromCollection = async () => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    const userDataRef = doc(db, 'usersData', uid)
    const exercisesRef = collection(userDataRef, 'exercises')
    const exerciseQ = query(exercisesRef)
    const exerciseQuerySnapshot = await getDocs(exerciseQ)

    const titles: string[] = []

    exerciseQuerySnapshot.forEach(doc => {
      const exerciseData = doc.data() as WorkoutDataType
      const exerciseTitle = exerciseData.name.toLowerCase().trim()
      titles.push(exerciseTitle)
      // workoutTitles[exerciseTitle] = ++workoutTitles[exerciseTitle] || 1
      // workoutTitle = workoutTitle.replace('day', '').toLowerCase()
      // if (workoutTitle === 'leg') workoutTitle = 'legs'

      // console.log(workoutData.name, workoutTitle)
      // updateDoc(doc.ref, {
      //   name: workoutTitle,
      // })
    })

    // updateDoc(userDataRef, {
    //   workoutTitles,
    // })
    await updateUniqueTitles('exerciseTitles', titles)
  }
}

// export const updateNumberOfDocuments = async () => {
//   const userDataRef = collection(db, 'usersData')
//   const userQ = query(userDataRef)
//   const userQRes = await getDocs(userQ)
//   const uidArr: string[] = []
//   userQRes.forEach(doc => {
//     uidArr.push(doc.id)
//   })

//   const addData = async (uid: string) => {
//     const usernamesRef = collection(db, 'usernames')
//     const q = query(usernamesRef, where('uid', '==', uid))
//     const queryRes = await getDocs(q)
//     let username: string = ''
//     queryRes.forEach(doc => {
//       username = doc.id
//     })
//     console.log(username)
//     const userProfileDataRef = doc(db, 'userProfileData', username)
//     const totalExercises = await getNumberOfTotalExercises(uid)
//     const totalWorkouts = await getNumberOfTotalWorkouts(uid)
//     await setDoc(
//       userProfileDataRef,
//       { totalExercises, totalWorkouts },
//       { merge: true }
//     )
//   }
//   uidArr.forEach(uid => {
//     addData(uid)
//   })

//   // const exercisesRef = collection(userDataRef, 'exercises')
// }

// export const addUsersData = () => {
//   const userProfileDataRef = collection(db, 'userProfileData')
//   console.log(userProfileData)
//   userProfileData.users.forEach(user => {
//     const { displayName, photoUrl, localId, createdAt } = user
//     const username =
//       displayName.trim().split(' ').join('').toLowerCase() +
//       createdAt.toString().slice(-7)
//     addUsername(localId, username)
//     const userProfileDataDoc = doc(userProfileDataRef, username)
//     const userData = {
//       displayName,
//       photoUrl,
//       username,
//       createdAt: Number(createdAt),
//     }
//     setDoc(userProfileDataDoc, userData)
//   })
//   console.log('done')
// }

// export const updateUsersData = async () => {
//   const userDataCollection = collection(db, 'usersData')
//   const usersQ = query(userDataCollection)
//   const usersQuerySnapshot = await getDocs(usersQ)
//   // const publicUserDataRef = doc(db, 'publicUserData', currUserID)

//   const userIDs: string[] = []

//   usersQuerySnapshot.forEach(doc => {
//     const currUserID = doc.id
//     userIDs.push(currUserID)
//   })

//   userIDs.forEach(userID => {
//     // getAdminAuth.getAuth(userID).then((res: any) => console.log(res))
//     // getAuth().getUser(userID)
//   })
// }
