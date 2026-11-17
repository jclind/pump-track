import {
  DocumentData,
  DocumentReference,
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
  runTransaction,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
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
import { errorMessage } from '../util/errorMessage'

// Firestore allows 500 writes per batch.
const WRITES_PER_BATCH = 450

// Enough for a year of daily entries, with room for two a day.
const CHART_RESULTS_LIMIT = 750

const showError = (error: unknown) => {
  console.log(error)
  toast.error(errorMessage(error), { position: 'bottom-center' })
}

const normalizeTitle = (title: string) => title.toLowerCase().trim()

// A write with no data is a delete.
type PendingWrite = { ref: DocumentReference; data?: DocumentData }

const commitInChunks = async (writes: PendingWrite[]) => {
  for (let i = 0; i < writes.length; i += WRITES_PER_BATCH) {
    const batch = writeBatch(db)
    writes.slice(i, i + WRITES_PER_BATCH).forEach(({ ref, data }) => {
      if (data) batch.set(ref, data)
      else batch.delete(ref)
    })
    await batch.commit()
  }
}

// One exercises doc per named exercise. Nameless ones, like a line with only
// numbers, stay in the workout doc but are left out of history.
const exerciseDocWrites = (
  userDataRef: DocumentReference,
  exercises: ExerciseDataType[],
  workoutID: string,
  workoutDate: number
): { writes: PendingWrite[]; titles: string[] } => {
  const writes: PendingWrite[] = []
  const titles: string[] = []
  exercises.forEach((exercise, idx) => {
    const name = normalizeTitle(exercise.name)
    if (!name) return
    titles.push(name)
    writes.push({
      ref: doc(userDataRef, 'exercises', exercise.id),
      data: {
        ...exercise,
        name,
        workoutID,
        workoutDate,
        index: idx,
        maxWeight: calculateMaxWeight(exercise.weights),
      },
    })
  })
  return { writes, titles }
}

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
      const workoutID = uuidv4()
      const parsedExercises: ExerciseDataType[] = exercises.map(ex => {
        return parseExercise(ex.text, ex.id)
      })

      const { title: workoutTitle, date } = getTitleAndDate(name)
      const workoutDate = date || new Date().getTime()

      const userDataRef = doc(db, 'usersData', uid)
      const workoutDocRef = doc(userDataRef, 'workouts', workoutID)

      const workoutData: WorkoutDataType = {
        name: workoutTitle,
        date: workoutDate,
        exercises: parsedExercises,
        id: workoutID,
      }

      const { writes, titles } = exerciseDocWrites(
        userDataRef,
        parsedExercises,
        workoutID,
        workoutDate
      )
      await commitInChunks([
        { ref: workoutDocRef, data: { ...workoutData } },
        ...writes,
      ])
      await updateUniqueTitles('workoutTitles', workoutTitle)
      await updateUniqueTitles('exerciseTitles', titles)

      await updateTotalWorkoutsAndExercises(1, titles.length)
      await updateUserActivity()

      return workoutData
    } catch (error) {
      showError(error)
    }
  }
}

// Throws on failure so the caller can keep its form open and say why.
// Returns the workouts as stored, with a date filled in where none was given.
export const importWorkouts = async (
  workouts: WorkoutDataType[]
): Promise<WorkoutDataType[]> => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in to import workouts')

  const titled = workouts.filter(workout => normalizeTitle(workout.name))
  if (titled.length === 0) throw new Error('No workouts with a title found')

  const userDataRef = doc(db, 'usersData', uid)
  // A workout typed without a date gets the same time on its workout doc
  // and its exercises docs.
  const now = Date.now()

  const writes: PendingWrite[] = []
  const workoutTitles: string[] = []
  const exerciseTitles: string[] = []

  const imported = titled.map(workout => {
    const workoutData: WorkoutDataType = {
      ...workout,
      name: normalizeTitle(workout.name),
      date: workout.date ?? now,
    }
    writes.push({
      ref: doc(userDataRef, 'workouts', workoutData.id),
      data: workoutData,
    })
    workoutTitles.push(workoutData.name)

    const exerciseWrites = exerciseDocWrites(
      userDataRef,
      workoutData.exercises,
      workoutData.id,
      workoutData.date!
    )
    writes.push(...exerciseWrites.writes)
    exerciseTitles.push(...exerciseWrites.titles)
    return workoutData
  })

  await commitInChunks(writes)
  await updateUniqueTitles('workoutTitles', workoutTitles)
  await updateUniqueTitles('exerciseTitles', exerciseTitles)
  await updateTotalWorkoutsAndExercises(imported.length, exerciseTitles.length)
  return imported
}

// Throws on failure, so the caller doesn't report a delete that didn't happen.
export const deleteWorkout = async (workoutID: string) => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in to delete workouts')

  const userDataRef = doc(db, 'usersData', uid)
  const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
  const exercisesRef = collection(userDataRef, 'exercises')

  const workoutSnapshot = await getDoc(workoutDocRef)
  const workoutName = workoutSnapshot.exists()
    ? (workoutSnapshot.data() as WorkoutDataType).name
    : null

  const exercisesQuerySnapshot = await getDocs(
    query(exercisesRef, where('workoutID', '==', workoutID))
  )
  const writes: PendingWrite[] = [{ ref: workoutDocRef }]
  const exerciseTitles: string[] = []
  exercisesQuerySnapshot.forEach(exerciseDoc => {
    writes.push({ ref: exerciseDoc.ref })
    const name = (exerciseDoc.data() as ExercisesServerDataType).name
    if (name) exerciseTitles.push(name)
  })

  await commitInChunks(writes)
  await updateUniqueTitles('workoutTitles', null, workoutName)
  await updateUniqueTitles('exerciseTitles', null, exerciseTitles)
  await updateTotalWorkoutsAndExercises(
    workoutSnapshot.exists() ? -1 : 0,
    -exercisesQuerySnapshot.size
  )
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
        where('name', '<=', queryText + ''),
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
    } catch (error) {
      showError(error)
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

      const sortedTitles = Object.keys(titles)
        .filter(title => titles[title] > 0)
        .sort(function (a, b) {
          return titles[b] - titles[a]
        })
      return sortedTitles
    } catch (error) {
      showError(error)
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
    } catch (error) {
      showError(error)
    }
  }
}

// Throws on failure; the Charts page shows the error and clears its spinner.
export const queryChartExerciseData = async (
  exerciseName: string,
  earliestDate: number
): Promise<{ data: ExercisesServerDataType[] } | undefined> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    const userDataRef = doc(db, 'usersData', uid)
    const exercisesRef = collection(userDataRef, 'exercises')

    const q = query(
      exercisesRef,
      where('name', '==', exerciseName.toLowerCase()),
      where('workoutDate', '>=', earliestDate),
      orderBy('workoutDate', 'desc'),
      limit(CHART_RESULTS_LIMIT)
    )

    const results: ExercisesServerDataType[] = []
    const querySnapshot = await getDocs(q)
    querySnapshot.forEach(doc => {
      results.push(doc.data() as ExercisesServerDataType)
    })

    return { data: results }
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
    } catch (error) {
      showError(error)
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

      let filtered = query(workoutsRef)
      if (workoutNameQuery) {
        filtered = query(filtered, where('name', '==', workoutNameQuery))
      }
      let q = query(filtered, orderBy('date', 'desc'), limit(resultsPerPage))
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const totalResultsSnapshot = await getCountFromServer(filtered)
      const totalResults = totalResultsSnapshot.data().count

      const querySnapshot = await getDocs(q)
      const workouts: WorkoutDataType[] = []
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
      querySnapshot.forEach(doc => {
        const data = doc.data() as WorkoutDataType
        workouts.push(data)
      })

      return { data: workouts, lastDoc: newLastDoc, totalResults }
    } catch (error) {
      showError(error)
    }
  }
}
export const getMostRecentWorkout = async () => {
  try {
    const workoutRes = await getWorkouts(1, null, null)
    const workoutData = workoutRes?.data[0] || null
    return workoutData
  } catch (error) {
    showError(error)
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
    } catch (error) {
      showError(error)
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
    } catch (error) {
      showError(error)
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
  } catch (error) {
    showError(error)
  }
}

// Saves one edited exercise of a past workout. Throws on failure, so the
// caller can put the old text back.
export const updateExercise = async (
  workout: WorkoutDataType,
  updatedExerciseData: ExerciseDataType
) => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in to edit workouts')

  const exerciseID = updatedExerciseData.id
  const userDataRef = doc(db, 'usersData', uid)
  const workoutDocRef = doc(userDataRef, 'workouts', workout.id)
  const exerciseDocRef = doc(userDataRef, 'exercises', exerciseID)

  const index = workout.exercises.findIndex(ex => ex.id === exerciseID)
  const updatedExerciseList = workout.exercises.map(ex =>
    ex.id === exerciseID ? updatedExerciseData : ex
  )

  await updateDoc(workoutDocRef, {
    exercises: updatedExerciseList,
  })

  // The exercises doc exists only if the old text had a name, and its name
  // is the one counted in exerciseTitles.
  const name = normalizeTitle(updatedExerciseData.name)
  const existing = await getDoc(exerciseDocRef)
  const oldName = existing.exists()
    ? (existing.data() as ExercisesServerDataType).name || null
    : null
  const maxWeight = calculateMaxWeight(updatedExerciseData.weights)

  if (!name) {
    if (existing.exists()) {
      await deleteDoc(exerciseDocRef)
      await updateTotalWorkoutsAndExercises(0, -1)
    }
  } else if (existing.exists()) {
    await updateDoc(exerciseDocRef, {
      name,
      weights: updatedExerciseData.weights,
      originalString: updatedExerciseData.originalString,
      maxWeight,
    })
  } else {
    await setDoc(exerciseDocRef, {
      ...updatedExerciseData,
      name,
      workoutID: workout.id,
      workoutDate: workout.date ?? Date.now(),
      index,
      maxWeight,
    })
    await updateTotalWorkoutsAndExercises(0, 1)
  }

  if (name !== (oldName ?? '')) {
    await updateUniqueTitles('exerciseTitles', name || null, oldName)
  }
  return updatedExerciseList
}

// Throws on failure, so the caller can put the old title back.
export const updateWorkout = async (
  currWorkoutData: WorkoutDataType,
  updatedData: { name?: string; date?: number }
) => {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in to edit workouts')

  const workoutID = currWorkoutData.id
  const userDataRef = doc(db, 'usersData', uid)
  const workoutDocRef = doc(userDataRef, 'workouts', workoutID)
  const data = { ...updatedData }
  if (data.name !== undefined) data.name = normalizeTitle(data.name)

  await updateDoc(workoutDocRef, data)
  if (data.name && data.name !== normalizeTitle(currWorkoutData.name)) {
    await updateUniqueTitles('workoutTitles', data.name, currWorkoutData.name)
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
    } catch (error) {
      showError(error)
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
    } catch (error) {
      showError(error)
    }
  }
}

const toTitleList = (titles: string | string[] | null) => {
  if (!titles) return []
  const list = typeof titles === 'string' ? [titles] : titles
  return list.map(normalizeTitle).filter(Boolean)
}

// Adds and removes counts in usersData/{uid}.workoutTitles or exerciseTitles.
// A transaction, so two saves at once can't overwrite each other's counts,
// and set() when the doc doesn't exist yet, as for a brand new user.
// Throws on failure.
export const updateUniqueTitles = async (
  field: 'workoutTitles' | 'exerciseTitles',
  addedTitles: string | string[] | null,
  removedTitles: string | string[] | null = null
) => {
  const uid = auth?.currentUser?.uid
  if (!uid) return
  const added = toTitleList(addedTitles)
  const removed = toTitleList(removedTitles)
  if (added.length === 0 && removed.length === 0) return

  const userDataRef = doc(db, 'usersData', uid)
  await runTransaction(db, async transaction => {
    const userDataDoc = await transaction.get(userDataRef)
    const titles: { [key: string]: number } = {
      ...(userDataDoc.data()?.[field] || {}),
    }

    added.forEach(title => {
      titles[title] = (titles[title] || 0) + 1
    })
    removed.forEach(title => {
      titles[title] = (titles[title] || 0) - 1
    })

    const filteredTitles: { [key: string]: number } = {}
    for (const [key, value] of Object.entries(titles)) {
      if (typeof value === 'number' && value > 0) {
        filteredTitles[key] = value
      }
    }
    if (userDataDoc.exists()) {
      transaction.update(userDataRef, { [field]: filteredTitles })
    } else {
      transaction.set(userDataRef, { [field]: filteredTitles })
    }
  })
}
