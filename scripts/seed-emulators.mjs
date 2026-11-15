// Seeds the local emulators with two test users, Alex and Blair, so a
// session can sign in as either one. `npm run dev:emu` runs this after the
// emulators start; firebase emulators:exec sets FIRESTORE_EMULATOR_HOST and
// FIREBASE_AUTH_EMULATOR_HOST, so the admin SDK only ever talks to them.
import { createRequire } from 'node:module'
import { createServer } from 'vite'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('seed-emulators: no emulator hosts set; run it through npm run dev:emu')
  process.exit(1)
}

// firebase-admin is a dependency of functions/, not of the app.
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

// The app's own parser builds the exercises, so seeded workouts have the
// same shape as ones typed into the app.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { parseExercise } = await vite.ssrLoadModule('/src/util/parseExercise.ts')
const { calculateMaxWeight } = await vite.ssrLoadModule('/src/util/calculateMaxWeight.ts')
const { SEEDED_TEST_ACCOUNTS } = await vite.ssrLoadModule('/src/services/testAccounts.ts')
await vite.close()

initializeApp({ projectId: 'demo-pump-track' })
const auth = getAuth()
const db = getFirestore()

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

// Workouts per test account, by uid. The accounts themselves are in
// src/services/testAccounts.ts, which the login page also reads.
const WORKOUTS = {
  'test-alex': [
    { name: 'push', daysAgo: 14, lines: ['Bench 135 8,8,8', 'Overhead press 85 8,8,6'] },
    { name: 'legs', daysAgo: 10, lines: ['Squat 185 5,5,5', 'Leg press 270 10,10'] },
    { name: 'push', daysAgo: 7, lines: ['Bench 145 8,8,6', 'Overhead press 90 8,6,6'] },
    { name: 'legs', daysAgo: 3, lines: ['Squat 195 5,5,5', 'Leg press 290 10,10'] },
    { name: 'push', daysAgo: 1, lines: ['Bench 150 6,6,6', 'Overhead press 90 8,8,7'] },
  ],
  'test-blair': [{ name: 'pull', daysAgo: 2, lines: ['Deadlift 225 5,5,5', 'Row 115 10,10,10'] }],
}
const users = SEEDED_TEST_ACCOUNTS.map(a => ({ ...a, displayName: a.name, workouts: WORKOUTS[a.uid] || [] }))

// Each test user gets a google.com provider whose id is the token's sub, so
// the login page's buttons and the emulator's Google picker both find it.
await auth.importUsers(
  users.map(u => ({
    uid: u.uid,
    email: u.email,
    emailVerified: true,
    displayName: u.displayName,
    metadata: { creationTime: new Date(now - 30 * DAY).toUTCString(), lastSignInTime: new Date(now - 30 * DAY).toUTCString() },
    providerData: [{ uid: u.sub, providerId: 'google.com', email: u.email, displayName: u.displayName }],
  }))
)

for (const u of users) {
  const batch = db.batch()
  const userData = db.doc(`usersData/${u.uid}`)
  const workoutTitles = {}
  const exerciseTitles = {}
  let numExercises = 0

  u.workouts.forEach((w, wi) => {
    const id = `${u.uid}-workout-${wi + 1}`
    const date = now - w.daysAgo * DAY
    const exercises = w.lines.map((line, ei) => parseExercise(line, `${id}-exercise-${ei + 1}`))
    batch.set(userData.collection('workouts').doc(id), { name: w.name, date, exercises, id })
    exercises.forEach((ex, index) => {
      const name = ex.name.toLowerCase()
      batch.set(userData.collection('exercises').doc(ex.id), {
        ...ex,
        name,
        workoutID: id,
        workoutDate: date,
        index,
        maxWeight: calculateMaxWeight(ex.weights),
      })
      exerciseTitles[name] = (exerciseTitles[name] || 0) + 1
      numExercises++
    })
    workoutTitles[w.name] = (workoutTitles[w.name] || 0) + 1
  })

  batch.set(userData, { workoutTitles, exerciseTitles })
  batch.set(db.doc(`usernames/${u.username}`), { uid: u.uid })
  batch.set(db.doc(`userProfileData/${u.uid}`), {
    createdAt: now - 30 * DAY,
    displayName: u.displayName,
    photoUrl: '',
    username: u.username,
    totalWorkouts: u.workouts.length,
    totalExercises: numExercises,
    lastActive: now - DAY,
  })
  await batch.commit()
  console.log(`seed-emulators: ${u.displayName} (${u.username}), workouts: ${u.workouts.length}`)
}
