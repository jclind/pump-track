import {
  GoogleAuthProvider,
  User,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { TestAccount } from './testAccounts'
import { auth, db, emulatorsOn, firebaseFunctions } from './firestore'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { UserProfileDataType } from '../types'
import { PUMP_TRACK_LS_USERNAME } from './PUMP_TRACK_LS'
import toast from 'react-hot-toast'
import { httpsCallable } from 'firebase/functions'

const errorMessage = (error: unknown): string =>
  (error as { message?: string } | null)?.message || String(error)

const reportError = (error: unknown) => {
  console.log(error)
  toast.error(errorMessage(error), { position: 'bottom-center' })
}

// Settles when the sign-up in progress has written the username. Signing in
// fires the auth listener straight away, and setUsername can take seconds on
// a cold start, so a username lookup waits for this instead of finding none.
let signupFinished: Promise<void> = Promise.resolve()

// Signs in through Google, or as a test account when the emulators are on.
// The Auth emulator accepts an unsigned token naming the account.
const signInWithGoogle = (testAccount?: TestAccount) => {
  if (testAccount && emulatorsOn) {
    const token = JSON.stringify({ ...testAccount, email_verified: true })
    return signInWithCredential(auth, GoogleAuthProvider.credential(token))
  }
  return signInWithPopup(auth, new GoogleAuthProvider())
}

// How many names to try before giving up when the generated one is taken.
const USERNAME_ATTEMPTS = 5

const randomSuffix = () =>
  Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0')

// Claims a username for the signed-in user, trying a new suffix whenever the
// name is taken.
const claimUsername = async (name: string, createdAt: string) => {
  for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? createdAt.slice(-7) : randomSuffix()
    const username = generateUsername(name, suffix)
    if (await addUsername(username)) return username
  }
  throw new Error(
    "Couldn't pick a username for your account. Try signing in again."
  )
}

// Creates whatever a sign-up left out. An earlier sign-up can stop between
// claiming the username and writing the profile, so this checks what exists
// instead of trusting that a returning user is complete.
const completeSignup = async (user: User) => {
  const { displayName, email, photoURL: photoUrl, uid } = user
  const userProfileDocRef = doc(db, 'userProfileData', uid)
  const profileSnap = await getDoc(userProfileDocRef)
  if (profileSnap.exists()) return

  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).getTime()
    : new Date().getTime()
  const name = displayName || email?.split('@')[0] || ''
  const username =
    (await findUsernameForUid(uid)) ||
    (await claimUsername(name, createdAt.toString()))

  const userProfileData: UserProfileDataType = {
    createdAt,
    displayName: displayName || '',
    photoUrl: photoUrl || '',
    username,
    totalWorkouts: 0,
    totalExercises: 0,
    lastActive: createdAt,
  }
  await setDoc(userProfileDocRef, userProfileData)
}

export const signupWithGoogle = async (testAccount?: TestAccount) => {
  let finishSignup = () => {}
  signupFinished = new Promise(resolve => {
    finishSignup = resolve
  })
  try {
    const cred = await signInWithGoogle(testAccount)
    try {
      await completeSignup(cred.user)
    } catch (error) {
      // Signed in without a profile, the app has nothing to show. Signing out
      // lets the next sign-in try again.
      await signOut(auth).catch(() => {})
      throw error
    }
  } catch (error) {
    reportError(error)
  } finally {
    finishSignup()
  }
}
export const logout = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    reportError(error)
  }
}

// Usernames are written only by the setUsername function, which takes the
// uid from the caller's sign-in. Resolves false when someone else has the
// name, and throws on any other failure.
export const addUsername = async (username: string) => {
  try {
    await httpsCallable(firebaseFunctions, 'setUsername')({ username })
    return true
  } catch (error) {
    if ((error as { code?: string })?.code === 'functions/already-exists') {
      return false
    }
    throw error
  }
}

// Returns null when no user has this username.
export const getUserData = async (
  username: string
): Promise<UserProfileDataType | null> => {
  const uid = await getUIDFromUsername(username)
  if (!uid) return null
  const userDataRes = await getDoc(doc(db, 'userProfileData', uid))
  if (!userDataRes.exists()) return null
  return userDataRes.data() as UserProfileDataType
}

// Usernames end up in URLs (/user/:username) and Firestore doc ids, so keep
// only lowercase letters, digits and underscores. setUsername refuses names
// over 100 characters, so cap the name part.
export const generateUsername = (name: string, suffix: string) => {
  const base = name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50)
  return (base || 'user') + suffix.replace(/[^a-z0-9_]/g, '')
}

const findUsernameForUid = async (uid: string) => {
  const q = query(collection(db, 'usernames'), where('uid', '==', uid))
  const queryRes = await getDocs(q)
  let username = ''
  queryRes.forEach(doc => {
    username = doc.id
  })
  return username
}

// A corrupt cache entry counts as a miss.
const readCachedUsername = (uid: string): string | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(PUMP_TRACK_LS_USERNAME)!)
    const username = cached?.[uid]
    return typeof username === 'string' && username ? username : null
  } catch {
    return null
  }
}

export const getUsername = async (): Promise<string | undefined> => {
  try {
    await signupFinished
    const uid = auth?.currentUser?.uid
    if (uid) {
      const cachedUsername = readCachedUsername(uid)
      if (cachedUsername) {
        return cachedUsername
      }
      const username = await findUsernameForUid(uid)
      if (username) {
        localStorage.setItem(
          PUMP_TRACK_LS_USERNAME,
          JSON.stringify({ [uid]: username })
        )
      }
      return username
    }
  } catch (error) {
    reportError(error)
  }
}
export const getUIDFromUsername = async (username: string) => {
  try {
    const usernamesRef = doc(db, 'usernames', username)
    const usernameRes = await getDoc(usernamesRef)
    if (!usernameRes.exists()) return null
    return usernameRes.data().uid ?? null
  } catch (error) {
    reportError(error)
  }
}

export const updateUserActivity = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const updateActivity = httpsCallable(firebaseFunctions, 'updateActivity')
      updateActivity({ uid })
    }
  } catch (error) {
    reportError(error)
  }
}
