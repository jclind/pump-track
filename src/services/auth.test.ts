import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateUsername,
  getUserData,
  getUsername,
  signupWithGoogle,
} from './auth'
import { auth } from './firestore'
import { signInWithCredential, signInWithPopup, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { PUMP_TRACK_LS_USERNAME } from './PUMP_TRACK_LS'

// Usernames held in the fake usernames collection, and the uids that have a
// profile doc
const usernames: { id: string; uid: string }[] = []
const profiles = new Set<string>()
// Names setUsername tried, in order
const attempts: string[] = []
// When set, setUsername stays pending until the test releases it, like a
// cold start
let holdSetUsername = false
let releaseSetUsername = () => {}
// Names someone else already owns
const taken = new Set<string>()

const T1 = 'Tue, 10 Nov 2026 19:14:30 GMT'
const T2 = 'Wed, 11 Nov 2026 08:00:00 GMT'
let lastSignInTime = T1

vi.mock('./firestore', () => ({
  auth: { currentUser: null },
  db: {},
  emulatorsOn: false,
  firebaseFunctions: {},
}))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(async (fakeAuth: { currentUser: unknown }) => {
    fakeAuth.currentUser = {
      uid: 'u1',
      displayName: 'Sam Lee',
      email: 'sam@example.com',
      photoURL: '',
      metadata: { creationTime: T1, lastSignInTime },
    }
    return { user: fakeAuth.currentUser }
  }),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(async (fakeAuth: { currentUser: unknown }) => {
    fakeAuth.currentUser = null
  }),
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, coll: string, id: string) => ({ coll, id })),
  getDoc: vi.fn(async (ref: { coll: string; id: string }) => {
    if (ref.coll === 'usernames') {
      const found = usernames.find(u => u.id === ref.id)
      return { exists: () => !!found, data: () => found }
    }
    return {
      exists: () => profiles.has(ref.id),
      data: () => ({ username: 'from-profile' }),
    }
  }),
  getDocs: vi.fn(async () => ({
    forEach: (cb: (d: { id: string }) => void) =>
      usernames.filter(u => u.uid === 'u1').forEach(u => cb({ id: u.id })),
  })),
  query: vi.fn(),
  setDoc: vi.fn(async (ref: { id: string }) => {
    profiles.add(ref.id)
  }),
  where: vi.fn(),
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (data: { username: string }) => {
    attempts.push(data.username)
    if (taken.has(data.username)) {
      throw Object.assign(new Error('username is taken'), {
        code: 'functions/already-exists',
      })
    }
    if (holdSetUsername) {
      await new Promise<void>(resolve => (releaseSetUsername = resolve))
    }
    usernames.push({ id: data.username, uid: 'u1' })
  },
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
  usernames.length = 0
  attempts.length = 0
  profiles.clear()
  taken.clear()
  holdSetUsername = false
  lastSignInTime = T1
  localStorage.clear()
  ;(auth as { currentUser: unknown }).currentUser = null
})

describe('getUsername', () => {
  it('waits for a sign-up in progress instead of finding no username', async () => {
    holdSetUsername = true
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
    ;(auth as { currentUser: unknown }).currentUser = { uid: 'u1' }
    expect(await getUsername()).toBe('')
    expect(localStorage.getItem(PUMP_TRACK_LS_USERNAME)).toBeNull()

    usernames.push({ id: 'samlee1', uid: 'u1' })
    expect(await getUsername()).toBe('samlee1')
    expect(JSON.parse(localStorage.getItem(PUMP_TRACK_LS_USERNAME)!)).toEqual({
      u1: 'samlee1',
    })
  })

  it('treats a corrupt cache entry as a miss', async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: 'u1' }
    usernames.push({ id: 'samlee1', uid: 'u1' })
    for (const bad of ['{not json', 'null', '"text"', '{"u1":5}']) {
      localStorage.setItem(PUMP_TRACK_LS_USERNAME, bad)
      expect(await getUsername()).toBe('samlee1')
    }
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('signupWithGoogle', () => {
  it('creates the username and profile for a new user', async () => {
    await signupWithGoogle()
    expect(attempts).toEqual(['samlee8070000'])
    expect(profiles.has('u1')).toBe(true)
    expect(vi.mocked(setDoc).mock.calls[0][1]).toMatchObject({
      username: 'samlee8070000',
      displayName: 'Sam Lee',
    })
  })

  it('leaves a returning user with a profile alone', async () => {
    lastSignInTime = T2
    profiles.add('u1')
    await signupWithGoogle()
    expect(attempts).toEqual([])
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('finishes an earlier sign-up that stopped before the profile', async () => {
    lastSignInTime = T2
    usernames.push({ id: 'samlee8070000', uid: 'u1' })
    await signupWithGoogle()
    // The username it already owns is reused, not claimed again
    expect(attempts).toEqual([])
    expect(vi.mocked(setDoc).mock.calls[0][1]).toMatchObject({
      username: 'samlee8070000',
    })
  })

  it('finishes an earlier sign-up that stopped before the username', async () => {
    lastSignInTime = T2
    await signupWithGoogle()
    expect(attempts).toEqual(['samlee8070000'])
    expect(profiles.has('u1')).toBe(true)
  })

  it('tries another suffix when the username is taken', async () => {
    taken.add('samlee8070000')
    await signupWithGoogle()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toMatch(/^samlee\d{7}$/)
    expect(vi.mocked(setDoc).mock.calls[0][1]).toMatchObject({
      username: attempts[1],
    })
  })

  it('reports an error and signs out when every name is taken', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    taken.add('samlee8070000')
    taken.add('samlee0000000')
    try {
      await signupWithGoogle()
    } finally {
      random.mockRestore()
    }
    expect(attempts).toHaveLength(5)
    expect(setDoc).not.toHaveBeenCalled()
    expect(signOut).toHaveBeenCalled()
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(
      /Couldn't pick a username/
    )
  })
})

describe('signupWithGoogle with a test account', () => {
  it('still uses the Google popup when the emulators are off', async () => {
    await signupWithGoogle({
      sub: 'google-test-alex',
      email: 'alex@example.com',
      name: 'Alex Tester',
    })

    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(signInWithPopup).toHaveBeenCalled()
  })
})

describe('generateUsername', () => {
  it('keeps only lowercase letters, digits and underscores', () => {
    expect(generateUsername('Sam Lee', '123')).toBe('samlee123')
    expect(generateUsername("José O'Brien-Smith", '1')).toBe(
      'joseobriensmith1'
    )
    expect(generateUsername('a/b?c#d%e.f', '9')).toBe('abcdef9')
    expect(generateUsername('snake_case', '0')).toBe('snake_case0')
  })

  it('falls back to user when nothing is left', () => {
    expect(generateUsername('李小龍', '42')).toBe('user42')
    expect(generateUsername('', '42')).toBe('user42')
  })

  it('caps the name part at 50 characters', () => {
    expect(generateUsername('x'.repeat(80), '1234567')).toHaveLength(57)
  })
})

describe('getUserData', () => {
  it('returns null for an unknown username without building a doc ref', async () => {
    expect(await getUserData('nobody')).toBeNull()
    expect(doc).not.toHaveBeenCalledWith(
      expect.anything(),
      'userProfileData',
      expect.anything()
    )
  })

  it('returns the profile of a known username', async () => {
    usernames.push({ id: 'sam', uid: 'u1' })
    profiles.add('u1')
    expect(await getUserData('sam')).toEqual({ username: 'from-profile' })
  })
})
