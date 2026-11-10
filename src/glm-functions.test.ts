import { describe, it, expect, vi, beforeEach } from 'vitest'

// The functions module calls initializeApp() and getFirestore() at import
// time, so the fake store has to exist before the import runs.
const h = vi.hoisted(() => {
  const INCREMENT = '__firebase_increment__'

  const applyValue = (current: unknown, value: any) => {
    if (
      value &&
      typeof value === 'object' &&
      (value as any)[INCREMENT] !== undefined
    ) {
      return (typeof current === 'number' ? current : 0) + value[INCREMENT]
    }
    return value
  }
  const applyData = (current: any, incoming: Record<string, unknown>) => {
    const result = { ...current }
    for (const [key, value] of Object.entries(incoming)) {
      result[key] = applyValue(result[key], value)
    }
    return result
  }

  const createFakeFirestore = () => {
    const docs = new Map<string, any>()
    const doc = (path: string) => ({
      get: async () => ({
        // firebase-admin exposes exists as a boolean property, not a method
        exists: docs.has(path),
        data: () => docs.get(path),
      }),
      set: async (data: any, options?: { merge?: boolean }) => {
        const current = options?.merge ? docs.get(path) : undefined
        docs.set(path, applyData(current ?? {}, data))
      },
      update: async (data: any) => {
        docs.set(path, applyData(docs.get(path) ?? {}, data))
      },
      delete: async () => {
        docs.delete(path)
      },
    })
    const collection = (path: string) => ({
      add: async (data: any) => {
        const id = `auto-id-${docs.size}`
        docs.set(`${path}/${id}`, data)
        return { id }
      },
      doc: (id: string) => doc(`${path}/${id}`),
      where: (field: string, _op: '==', value: unknown) => ({
        get: async () => ({
          docs: [...docs.entries()]
            .filter(
              ([docPath, data]) =>
                docPath.startsWith(`${path}/`) &&
                !docPath.slice(path.length + 1).includes('/') &&
                data?.[field] === value
            )
            .map(([docPath]) => ({ ref: doc(docPath) })),
        }),
      }),
    })
    // Runs the transaction straight against the store. Good enough for
    // single-caller tests; it doesn't model contention.
    const runTransaction = async (fn: (transaction: any) => Promise<any>) =>
      fn({
        get: (refOrQuery: any) => refOrQuery.get(),
        set: (ref: any, data: any) => ref.set(data),
        delete: (ref: any) => ref.delete(),
      })
    return { docs, doc, collection, runTransaction }
  }

  return { store: createFakeFirestore(), INCREMENT }
})

// The packages live only in functions/node_modules, so bare specifiers from
// src/ do not resolve. The mocks target the exact files the exports map
// points the functions code at (import condition).
vi.mock(
  '../functions/node_modules/firebase-functions/lib/esm/v1/index.mjs',
  () => ({
    https: {
      // unwrap onCall so the raw handler (data, context) can be invoked
      onCall: (fn: any) => fn,
      HttpsError: class HttpsError extends Error {
        code: string
        constructor(code: string, message: string) {
          super(message)
          this.code = code
        }
      },
    },
  })
)
vi.mock('../functions/node_modules/firebase-admin/lib/esm/app/index.js', () => ({
  initializeApp: vi.fn(),
}))
vi.mock(
  '../functions/node_modules/firebase-admin/lib/esm/auth/index.js',
  () => ({
    getAuth: vi.fn(() => ({
      getUser: async (uid: string) => ({
        uid,
        displayName: `display-${uid}`,
        email: `${uid}@example.com`,
        photoURL: `photo-${uid}`,
      }),
    })),
  })
)
vi.mock(
  '../functions/node_modules/firebase-admin/lib/esm/firestore/index.js',
  () => ({
    getFirestore: () => h.store,
    FieldValue: { increment: (n: number) => ({ [h.INCREMENT]: n }) },
  })
)

import {
  FRIENDS,
  INCOMING_FRIEND_REQUESTS,
  OUTGOING_FRIEND_REQUESTS,
  acceptFriendRequest as acceptFriendRequestFn,
  addFriend as addFriendFn,
  checkIfFriends as checkIfFriendsFn,
  getFriendshipStatus as getFriendshipStatusFn,
  getNumberOfFriends as getNumberOfFriendsFn,
  getUsersFriendData as getUsersFriendDataFn,
  removeFriend as removeFriendFn,
  sendFriendAcceptedEmail as sendFriendAcceptedEmailFn,
  sendFriendRequestEmail as sendFriendRequestEmailFn,
  setUsername as setUsernameFn,
  updateTotalWorkoutsAndExercises as updateTotalWorkoutsAndExercisesFn,
} from '../functions/src/index'

// The onCall mock returns the raw (data, context) handler, but the exports
// are typed as deployed HTTPS functions. Retype them for the tests.
type Handler = (data: any, context: any) => Promise<any>
const call = (fn: unknown) => fn as Handler
const acceptFriendRequest = call(acceptFriendRequestFn)
const addFriend = call(addFriendFn)
const checkIfFriends = call(checkIfFriendsFn)
const getFriendshipStatus = call(getFriendshipStatusFn)
const getNumberOfFriends = call(getNumberOfFriendsFn)
const getUsersFriendData = call(getUsersFriendDataFn)
const removeFriend = call(removeFriendFn)
const sendFriendAcceptedEmail = call(sendFriendAcceptedEmailFn)
const sendFriendRequestEmail = call(sendFriendRequestEmailFn)
const setUsername = call(setUsernameFn)
const updateTotalWorkoutsAndExercises = call(updateTotalWorkoutsAndExercisesFn)

const CURR = 'curr-uid'
const FRIEND = 'friend-uid'
const authContext = { auth: { uid: CURR } }
const otherContext = { auth: { uid: 'other-uid' } }

const setDoc = (path: string, data: any) => h.store.doc(path).set(data)
const getDocData = (path: string) => h.store.docs.get(path)
const docExists = (path: string) => h.store.docs.has(path)
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const friendRequestData = () => ({
  currUID: CURR,
  friendUID: FRIEND,
  currUsername: 'curr-name',
  friendUsername: 'friend-name',
})

beforeEach(() => {
  h.store.docs.clear()
})

describe('getFriendshipStatus', () => {
  it('reports friends when the friends doc exists', async () => {
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, { date: 1 })

    const status = await getFriendshipStatus(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    expect(status).toBe('friends')
  })

  it('prefers friends over pending requests in both directions', async () => {
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, {})
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    const status = await getFriendshipStatus(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    expect(status).toBe('friends')
  })

  it('reports outgoing before incoming', async () => {
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    const status = await getFriendshipStatus(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    expect(status).toBe('outgoing')
  })

  it('reports incoming when only the friend has sent a request', async () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    const status = await getFriendshipStatus(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    expect(status).toBe('incoming')
  })

  it('reports not_friends when no relation docs exist', async () => {
    const status = await getFriendshipStatus(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    expect(status).toBe('not_friends')
  })

  it('rejects when the uids are missing', async () => {
    await expect(
      getFriendshipStatus({ currUID: CURR }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('addFriend', () => {
  it('creates an outgoing request for the caller and an incoming one for the friend', async () => {
    await addFriend(friendRequestData(), authContext)

    expect(
      getDocData(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toMatchObject({
      friendUID: FRIEND,
      friendUsername: 'friend-name',
      date: expect.any(Number),
    })
    expect(
      getDocData(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toMatchObject({
      friendUID: CURR,
      friendUsername: 'curr-name',
      date: expect.any(Number),
    })
  })

  it('refuses when the users are already friends', async () => {
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
  })

  it('refuses when a request is already pending', async () => {
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(false)
  })

  it('refuses when the friend already sent the caller a request', async () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
  })

  it('rejects a request that is missing currUsername', async () => {
    await expect(
      addFriend(
        { currUID: CURR, friendUID: FRIEND, friendUsername: 'f' },
        authContext
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('acceptFriendRequest', () => {
  const seedPendingRequest = () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${FRIEND}/${OUTGOING_FRIEND_REQUESTS}/${CURR}`, {})
    setDoc(`userProfileData/${CURR}`, { numFriends: 2 })
    setDoc(`userProfileData/${FRIEND}`, { numFriends: 0 })
  }

  it('moves the request to friendship on both sides and bumps counts', async () => {
    seedPendingRequest()

    await acceptFriendRequest(friendRequestData(), authContext)
    await flush()

    expect(
      getDocData(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)
    ).toMatchObject({ friendUID: FRIEND, friendUsername: 'friend-name' })
    expect(
      getDocData(`userProfileData/${FRIEND}/${FRIENDS}/${CURR}`)
    ).toMatchObject({ friendUID: CURR, friendUsername: 'curr-name' })
    expect(getDocData(`userProfileData/${CURR}`).numFriends).toBe(3)
    expect(getDocData(`userProfileData/${FRIEND}`).numFriends).toBe(1)
    expect(
      docExists(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
    expect(
      docExists(`userProfileData/${FRIEND}/${OUTGOING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(false)
  })

  it('refuses when no request was incoming', async () => {
    await expect(
      acceptFriendRequest(friendRequestData(), authContext)
    ).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(docExists(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)).toBe(
      false
    )
  })

  it('refuses when the users are already friends', async () => {
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, {})

    await expect(
      acceptFriendRequest(friendRequestData(), authContext)
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })
})

describe('removeFriend', () => {
  const seedFriendship = () => {
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, {})
    setDoc(`userProfileData/${FRIEND}/${FRIENDS}/${CURR}`, {})
    setDoc(`userProfileData/${CURR}`, { numFriends: 1 })
    setDoc(`userProfileData/${FRIEND}`, { numFriends: 1 })
  }

  it('deletes the friendship on both sides and decrements counts', async () => {
    seedFriendship()

    await removeFriend(
      { currUID: CURR, friendUID: FRIEND },
      authContext
    )
    await flush()

    expect(docExists(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)).toBe(
      false
    )
    expect(docExists(`userProfileData/${FRIEND}/${FRIENDS}/${CURR}`)).toBe(
      false
    )
    expect(getDocData(`userProfileData/${CURR}`).numFriends).toBe(0)
    expect(getDocData(`userProfileData/${FRIEND}`).numFriends).toBe(0)
  })

  it('refuses when the users are not friends', async () => {
    await expect(
      removeFriend({ currUID: CURR, friendUID: FRIEND }, authContext)
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })
})

describe('getNumberOfFriends', () => {
  it('reads the stored count', async () => {
    setDoc(`userProfileData/${CURR}`, { numFriends: 5 })

    const count = await getNumberOfFriends({ uid: CURR }, authContext)
    expect(count).toBe(5)
  })

  it('returns 0 when the profile has no count', async () => {
    const count = await getNumberOfFriends({ uid: CURR }, authContext)
    expect(count).toBe(0)
  })
})

describe('updateTotalWorkoutsAndExercises', () => {
  it('increments the stored totals by the given amounts', async () => {
    setDoc(`userProfileData/${CURR}`, {
      totalWorkouts: 2,
      totalExercises: 10,
    })

    await updateTotalWorkoutsAndExercises(
      { uid: CURR, numWorkouts: 1, numExercises: 3 },
      authContext
    )
    await flush()

    expect(getDocData(`userProfileData/${CURR}`)).toMatchObject({
      totalWorkouts: 3,
      totalExercises: 13,
    })
  })
})

describe('sendFriendRequestEmail', () => {
  it('queues a mail document addressed to the friend', async () => {
    await sendFriendRequestEmail(
      {
        currUID: CURR,
        friendUID: FRIEND,
        currUsername: 'curr-name',
      },
      authContext
    )

    const mailDocs = [...h.store.docs.entries()].filter(([path]) =>
      path.startsWith('mail/')
    )
    expect(mailDocs).toHaveLength(1)
    const mail = mailDocs[0][1]
    expect(mail.to).toEqual(['friend-uid@example.com'])
    expect(mail.message.subject).toBe('New Friend Request')
    expect(mail.message.html).toContain('display-friend-uid')
    expect(mail.message.html).toContain('@curr-name')
  })
})

describe('caller checks', () => {
  it.each([
    ['addFriend', () => addFriend(friendRequestData(), otherContext)],
    [
      'acceptFriendRequest',
      () => acceptFriendRequest(friendRequestData(), otherContext),
    ],
    [
      'checkIfFriends',
      () => checkIfFriends({ currUID: CURR, friendUID: FRIEND }, otherContext),
    ],
    [
      'getFriendshipStatus',
      () =>
        getFriendshipStatus({ currUID: CURR, friendUID: FRIEND }, otherContext),
    ],
    ['getNumberOfFriends', () => getNumberOfFriends({ uid: CURR }, otherContext)],
  ])('%s rejects a uid that is not the caller', async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('addFriend writes nothing for a uid that is not the caller', async () => {
    await expect(
      addFriend(friendRequestData(), otherContext)
    ).rejects.toBeTruthy()
    expect(h.store.docs.size).toBe(0)
  })

  it('acceptFriendRequest writes nothing for a uid that is not the caller', async () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    await expect(
      acceptFriendRequest(friendRequestData(), otherContext)
    ).rejects.toBeTruthy()
    expect(docExists(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)).toBe(
      false
    )
  })

  it('getUsersFriendData rejects a signed-out caller', async () => {
    await expect(
      getUsersFriendData({ usersFriendList: [] }, {})
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('getUsersFriendData still answers a signed-in caller', async () => {
    setDoc(`userProfileData/${FRIEND}`, { username: 'friend-name' })

    const result = await getUsersFriendData(
      {
        usersFriendList: [
          { friendUID: FRIEND, friendUsername: 'friend-name', date: 1 },
        ],
      },
      authContext
    )
    expect(result).toEqual([
      expect.objectContaining({ friendUID: FRIEND, username: 'friend-name' }),
    ])
  })
})

describe('friend email html', () => {
  const mailHtml = () => {
    const mail = [...h.store.docs.entries()].find(([path]) =>
      path.startsWith('mail/')
    )
    return mail?.[1].message.html as string
  }

  it.each([
    ['sendFriendRequestEmail', () => sendFriendRequestEmail],
    ['sendFriendAcceptedEmail', () => sendFriendAcceptedEmail],
  ])('%s escapes the username', async (_name, fn) => {
    await fn()(
      { currUID: CURR, friendUID: FRIEND, currUsername: '<b>x</b>"' },
      authContext
    )

    const html = mailHtml()
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('@&lt;b&gt;x&lt;/b&gt;&quot;')
    expect(html).toContain(
      'href="https://pumptrack.netlify.app/user/%3Cb%3Ex%3C%2Fb%3E%22"'
    )
  })
})

describe('setUsername', () => {
  it('claims a free username for the caller', async () => {
    await setUsername({ username: 'new-name' }, authContext)
    await flush()

    expect(getDocData('usernames/new-name')).toEqual({ uid: CURR })
  })

  it("releases the caller's old username", async () => {
    setDoc('usernames/old-name', { uid: CURR })
    setDoc('usernames/someone-else', { uid: FRIEND })

    await setUsername({ username: 'new-name' }, authContext)
    await flush()

    expect(docExists('usernames/old-name')).toBe(false)
    expect(getDocData('usernames/new-name')).toEqual({ uid: CURR })
    expect(getDocData('usernames/someone-else')).toEqual({ uid: FRIEND })
  })

  it("refuses a username someone else holds and changes nothing", async () => {
    setDoc('usernames/taken', { uid: FRIEND })
    setDoc('usernames/old-name', { uid: CURR })

    await expect(
      setUsername({ username: 'taken' }, authContext)
    ).rejects.toMatchObject({ code: 'already-exists' })
    expect(getDocData('usernames/taken')).toEqual({ uid: FRIEND })
    expect(getDocData('usernames/old-name')).toEqual({ uid: CURR })
  })

  it('does nothing when the caller already holds the username', async () => {
    setDoc('usernames/mine', { uid: CURR })

    await setUsername({ username: 'mine' }, authContext)

    expect(getDocData('usernames/mine')).toEqual({ uid: CURR })
  })

  it('takes the uid from the sign-in, not the payload', async () => {
    await setUsername({ username: 'new-name', uid: FRIEND }, authContext)
    await flush()

    expect(getDocData('usernames/new-name')).toEqual({ uid: CURR })
  })

  it('rejects a signed-out caller', async () => {
    await expect(
      setUsername({ username: 'new-name' }, {})
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it.each([[''], ['a/b'], ['.'], ['..'], ['__x__'], [42], ['x'.repeat(101)]])(
    'rejects the username %j',
    async username => {
      await expect(
        setUsername({ username }, authContext)
      ).rejects.toMatchObject({ code: 'invalid-argument' })
      expect(h.store.docs.size).toBe(0)
    }
  )
})
