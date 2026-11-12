import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUsername, signupWithGoogle } from './auth'
import { auth } from './firestore'
import { PUMP_TRACK_LS_USERNAME } from './PUMP_TRACK_LS'

// Usernames held in the fake usernames collection
const usernames: { id: string; uid: string }[] = []
let releaseSetUsername = () => {}

vi.mock('./firestore', () => ({
  auth: { currentUser: null },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(async (fakeAuth: any) => {
    const t = 'Tue, 10 Nov 2026 19:14:30 GMT'
    fakeAuth.currentUser = {
      uid: 'u1',
      displayName: 'Sam Lee',
      email: 'sam@example.com',
      photoURL: '',
      metadata: { creationTime: t, lastSignInTime: t },
    }
    return { user: fakeAuth.currentUser }
  }),
  signOut: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({
    forEach: (cb: (d: { id: string }) => void) =>
      usernames.filter(u => u.uid === 'u1').forEach(u => cb({ id: u.id })),
  })),
  query: vi.fn(),
  setDoc: vi.fn(async () => {}),
  where: vi.fn(),
}))
// setUsername stays pending until the test releases it, like a cold start
vi.mock('firebase/functions', () => ({
  httpsCallable: () => (data: { username: string }) =>
    new Promise<void>(resolve => {
      releaseSetUsername = () => {
        usernames.push({ id: data.username, uid: 'u1' })
        resolve()
      }
    }),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  usernames.length = 0
  localStorage.clear()
  ;(auth as any).currentUser = null
})

describe('getUsername', () => {
  it('waits for a sign-up in progress instead of finding no username', async () => {
    const signup = signupWithGoogle()
    await tick()
    let found: string | undefined
    const lookup = getUsername().then(name => (found = name))
    await tick()
    expect(found).toBeUndefined()

    releaseSetUsername()
    await signup
    await lookup
    expect(found).toBe('samlee8070000')
  })

  it('caches the username under the uid, and never caches an empty one', async () => {
    ;(auth as any).currentUser = { uid: 'u1' }
    expect(await getUsername()).toBe('')
    expect(localStorage.getItem(PUMP_TRACK_LS_USERNAME)).toBeNull()

    usernames.push({ id: 'samlee1', uid: 'u1' })
    expect(await getUsername()).toBe('samlee1')
    expect(JSON.parse(localStorage.getItem(PUMP_TRACK_LS_USERNAME)!)).toEqual({
      u1: 'samlee1',
    })
  })
})
