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

  const notFound = () => Object.assign(new Error('NOT_FOUND'), { code: 5 })

  const createFakeFirestore = () => {
    const docs = new Map<string, any>()
    const snapshot = (path: string): any => ({
      id: path.split('/').pop(),
      ref: doc(path),
      // firebase-admin exposes exists as a boolean property, not a method
      exists: docs.has(path),
      data: () => docs.get(path),
    })
    const doc = (path: string): any => ({
      path,
      id: path.split('/').pop(),
      get: async () => snapshot(path),
      set: async (data: any, options?: { merge?: boolean }) => {
        const current = options?.merge ? docs.get(path) : undefined
        docs.set(path, applyData(current ?? {}, data))
      },
      // Like firebase-admin, update fails on a missing doc.
      update: async (data: any) => {
        if (!docs.has(path)) throw notFound()
        docs.set(path, applyData(docs.get(path), data))
      },
      delete: async () => {
        docs.delete(path)
      },
    })
    type Filter = { field: string; op: string; value: unknown }
    const query = (
      path: string,
      filters: Filter[] = [],
      order?: { field: string; dir: string },
      max?: number,
      after?: any
    ): any => ({
      where: (field: string, op: string, value: unknown) =>
        query(path, [...filters, { field, op, value }], order, max, after),
      orderBy: (field: string, dir = 'asc') =>
        query(path, filters, { field, dir }, max, after),
      limit: (n: number) => query(path, filters, order, n, after),
      startAfter: (snap: any) => query(path, filters, order, max, snap),
      get: async () => {
        let paths = [...docs.keys()].filter(
          docPath =>
            docPath.startsWith(`${path}/`) &&
            !docPath.slice(path.length + 1).includes('/')
        )
        for (const { field, op, value } of filters) {
          paths = paths.filter(docPath => {
            const v = docs.get(docPath)?.[field]
            return op === '>' ? v > (value as any) : v === value
          })
        }
        if (order) {
          const sign = order.dir === 'desc' ? -1 : 1
          paths.sort(
            (a, b) =>
              sign * (docs.get(a)[order.field] - docs.get(b)[order.field])
          )
        }
        if (after) paths = paths.slice(paths.indexOf(after.ref.path) + 1)
        if (max !== undefined) paths = paths.slice(0, max)
        h.reads += paths.length
        const result = paths.map(snapshot)
        return { empty: result.length === 0, docs: result }
      },
    })
    const collection = (path: string) => ({
      ...query(path),
      add: async (data: any) => {
        const id = `auto-id-${docs.size}`
        docs.set(`${path}/${id}`, data)
        return { id }
      },
      doc: (id: string) => doc(`${path}/${id}`),
    })
    const getAll = async (...refs: any[]) => {
      h.getAllCalls++
      h.reads += refs.length
      return Promise.all(refs.map(ref => ref.get()))
    }
    // Queues writes and applies them on commit, so a failed check part way
    // through leaves nothing written.
    const writer = () => {
      const ops: (() => Promise<void>)[] = []
      return {
        ops,
        set: (ref: any, data: any, options?: any) => {
          ops.push(() => ref.set(data, options))
        },
        update: (ref: any, data: any) => {
          ops.push(() => ref.update(data))
        },
        delete: (ref: any) => {
          ops.push(() => ref.delete())
        },
        commit: async () => {
          for (const op of ops) await op()
        },
      }
    }
    const batch = () => writer()
    // Single caller only; it doesn't model contention.
    const runTransaction = async (fn: (transaction: any) => Promise<any>) => {
      const w = writer()
      const result = await fn({
        get: (refOrQuery: any) => refOrQuery.get(),
        getAll,
        set: w.set,
        update: w.update,
        delete: w.delete,
      })
      await w.commit()
      return result
    }
    return { docs, doc, collection, getAll, batch, runTransaction }
  }

  const h = {
    store: undefined as any,
    INCREMENT,
    reads: 0,
    getAllCalls: 0,
    noEmail: new Set<string>(),
  }
  h.store = createFakeFirestore()
  return h
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
        email: h.noEmail.has(uid) ? undefined : `${uid}@example.com`,
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
  getSuggestedFriends as getSuggestedFriendsFn,
  getUsersFriendData as getUsersFriendDataFn,
  removeFriend as removeFriendFn,
  removeIncomingRequest as removeIncomingRequestFn,
  removeOutgoingRequest as removeOutgoingRequestFn,
  sendFriendAcceptedEmail as sendFriendAcceptedEmailFn,
  sendFriendRequestEmail as sendFriendRequestEmailFn,
  setUsername as setUsernameFn,
  updateActivity as updateActivityFn,
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
const getSuggestedFriends = call(getSuggestedFriendsFn)
const getUsersFriendData = call(getUsersFriendDataFn)
const removeFriend = call(removeFriendFn)
const removeIncomingRequest = call(removeIncomingRequestFn)
const removeOutgoingRequest = call(removeOutgoingRequestFn)
const sendFriendAcceptedEmail = call(sendFriendAcceptedEmailFn)
const sendFriendRequestEmail = call(sendFriendRequestEmailFn)
const setUsername = call(setUsernameFn)
const updateActivity = call(updateActivityFn)
const updateTotalWorkoutsAndExercises = call(updateTotalWorkoutsAndExercisesFn)

const CURR = 'curr-uid'
const FRIEND = 'friend-uid'
const authContext = { auth: { uid: CURR } }
const otherContext = { auth: { uid: 'other-uid' } }

const setDoc = (path: string, data: any) => h.store.doc(path).set(data)
const getDocData = (path: string) => h.store.docs.get(path)
const docExists = (path: string) => h.store.docs.has(path)
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const mailDocs = () =>
  [...h.store.docs.entries()]
    .filter(([path]) => path.startsWith('mail/'))
    .map(([, data]) => data)

// The client sends usernames too. The functions ignore them, so these are
// deliberately different from the stored ones.
const friendRequestData = () => ({
  currUID: CURR,
  friendUID: FRIEND,
  currUsername: 'client-curr-name',
  friendUsername: 'client-friend-name',
})

const seedProfiles = () => {
  setDoc(`userProfileData/${CURR}`, { username: 'curr-name', numFriends: 0 })
  setDoc(`userProfileData/${FRIEND}`, {
    username: 'friend-name',
    numFriends: 0,
  })
}

beforeEach(() => {
  h.store.docs.clear()
  h.noEmail.clear()
  h.reads = 0
  h.getAllCalls = 0
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
    seedProfiles()

    await addFriend(friendRequestData(), authContext)

    expect(
      getDocData(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toEqual({
      friendUID: FRIEND,
      friendUsername: 'friend-name',
      date: expect.any(Number),
    })
    expect(
      getDocData(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toEqual({
      friendUID: CURR,
      friendUsername: 'curr-name',
      date: expect.any(Number),
    })
  })

  it('falls back to the usernames collection when the profile has no username', async () => {
    setDoc(`userProfileData/${CURR}`, {})
    setDoc(`userProfileData/${FRIEND}`, {})
    setDoc('usernames/curr-from-index', { uid: CURR })
    setDoc('usernames/friend-from-index', { uid: FRIEND })

    await addFriend(friendRequestData(), authContext)

    expect(
      getDocData(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
        .friendUsername
    ).toBe('friend-from-index')
    expect(
      getDocData(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
        .friendUsername
    ).toBe('curr-from-index')
  })

  it('still accepts a request without the client usernames', async () => {
    seedProfiles()

    await addFriend({ currUID: CURR, friendUID: FRIEND }, authContext)

    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(true)
  })

  it('emails the friend once, with the stored username', async () => {
    seedProfiles()

    await addFriend(friendRequestData(), authContext)

    const mails = mailDocs()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toEqual(['friend-uid@example.com'])
    expect(mails[0].message.subject).toBe('New Friend Request')
    expect(mails[0].message.html).toContain('display-friend-uid')
    expect(mails[0].message.html).toContain('@curr-name')
    expect(mails[0].message.html).not.toContain('client-curr-name')
  })

  it('sends one request email when a request is sent, cancelled and sent again', async () => {
    seedProfiles()

    await addFriend(friendRequestData(), authContext)
    await removeOutgoingRequest({ currUID: CURR, friendUID: FRIEND }, authContext)
    await addFriend(friendRequestData(), authContext)

    expect(mailDocs()).toHaveLength(1)
    expect(
      docExists(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(true)
  })

  it('skips the email when the friend has no email address', async () => {
    seedProfiles()
    h.noEmail.add(FRIEND)

    await addFriend(friendRequestData(), authContext)

    expect(mailDocs()).toHaveLength(0)
    expect(
      docExists(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(true)
  })

  it('refuses to friend yourself', async () => {
    seedProfiles()

    await expect(
      addFriend({ ...friendRequestData(), friendUID: CURR }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(h.store.docs.size).toBe(2)
  })

  it.each([['a/b'], [''], [42], ['x'.repeat(129)]])(
    'rejects the friendUID %j',
    async friendUID => {
      await expect(
        addFriend({ ...friendRequestData(), friendUID }, authContext)
      ).rejects.toMatchObject({ code: 'invalid-argument' })
      expect(h.store.docs.size).toBe(0)
    }
  )

  it('refuses a friend with no profile', async () => {
    setDoc(`userProfileData/${CURR}`, { username: 'curr-name' })

    await expect(
      addFriend(friendRequestData(), authContext)
    ).rejects.toMatchObject({ code: 'not-found' })
    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
    expect(mailDocs()).toHaveLength(0)
  })

  it('refuses when the users are already friends', async () => {
    seedProfiles()
    setDoc(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
  })

  it('refuses when a request is already pending, and sends no email', async () => {
    seedProfiles()
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(false)
    expect(mailDocs()).toHaveLength(0)
  })

  it('refuses when the friend already sent the caller a request', async () => {
    seedProfiles()
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})

    await expect(addFriend(friendRequestData(), authContext)).rejects.toMatchObject(
      { code: 'failed-precondition' }
    )
    expect(
      docExists(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
  })
})

describe('acceptFriendRequest', () => {
  const seedPendingRequest = () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${FRIEND}/${OUTGOING_FRIEND_REQUESTS}/${CURR}`, {})
    setDoc(`userProfileData/${CURR}`, { username: 'curr-name', numFriends: 2 })
    setDoc(`userProfileData/${FRIEND}`, {
      username: 'friend-name',
      numFriends: 0,
    })
  }

  it('moves the request to friendship on both sides and bumps counts', async () => {
    seedPendingRequest()

    await acceptFriendRequest(friendRequestData(), authContext)

    expect(getDocData(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)).toEqual({
      friendUID: FRIEND,
      friendUsername: 'friend-name',
      date: expect.any(Number),
    })
    expect(getDocData(`userProfileData/${FRIEND}/${FRIENDS}/${CURR}`)).toEqual({
      friendUID: CURR,
      friendUsername: 'curr-name',
      date: expect.any(Number),
    })
    expect(getDocData(`userProfileData/${CURR}`).numFriends).toBe(3)
    expect(getDocData(`userProfileData/${FRIEND}`).numFriends).toBe(1)
    expect(
      docExists(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`)
    ).toBe(false)
    expect(
      docExists(`userProfileData/${FRIEND}/${OUTGOING_FRIEND_REQUESTS}/${CURR}`)
    ).toBe(false)
  })

  it('emails the requester once with the accepted wording', async () => {
    seedPendingRequest()

    await acceptFriendRequest(friendRequestData(), authContext)

    const mails = mailDocs()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toEqual(['friend-uid@example.com'])
    expect(mails[0].message.subject).toBe('Friend Request Accepted')
    expect(mails[0].message.html).toContain(
      'display-curr-uid accepted your friend request'
    )
    expect(mails[0].message.html).not.toContain('You have received')
    expect(mails[0].message.text).toContain('@curr-name')
  })

  it('a second accept fails and does not count twice', async () => {
    seedPendingRequest()

    await acceptFriendRequest(friendRequestData(), authContext)
    await expect(
      acceptFriendRequest(friendRequestData(), authContext)
    ).rejects.toMatchObject({ code: 'failed-precondition' })

    expect(getDocData(`userProfileData/${CURR}`).numFriends).toBe(3)
    expect(getDocData(`userProfileData/${FRIEND}`).numFriends).toBe(1)
    expect(mailDocs()).toHaveLength(1)
  })

  it('refuses when no request was incoming', async () => {
    await expect(
      acceptFriendRequest(friendRequestData(), authContext)
    ).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(docExists(`userProfileData/${CURR}/${FRIENDS}/${FRIEND}`)).toBe(
      false
    )
  })

  it('refuses to accept yourself', async () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${CURR}`, {})

    await expect(
      acceptFriendRequest({ ...friendRequestData(), friendUID: CURR }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(docExists(`userProfileData/${CURR}/${FRIENDS}/${CURR}`)).toBe(false)
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

    await removeFriend({ currUID: CURR, friendUID: FRIEND }, authContext)

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

  it('checks sign-in first, then arguments, then the caller', async () => {
    await expect(removeFriend({}, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    await expect(
      removeFriend({ currUID: CURR }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(
      removeFriend({ currUID: CURR, friendUID: FRIEND }, otherContext)
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('removing requests', () => {
  it('removeIncomingRequest deletes both sides', async () => {
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${FRIEND}/${OUTGOING_FRIEND_REQUESTS}/${CURR}`, {})

    await removeIncomingRequest({ currUID: CURR, friendUID: FRIEND }, authContext)

    expect(h.store.docs.size).toBe(0)
  })

  it('removeOutgoingRequest deletes both sides', async () => {
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/${FRIEND}`, {})
    setDoc(`userProfileData/${FRIEND}/${INCOMING_FRIEND_REQUESTS}/${CURR}`, {})

    await removeOutgoingRequest({ currUID: CURR, friendUID: FRIEND }, authContext)

    expect(h.store.docs.size).toBe(0)
  })

  it('removeOutgoingRequest rejects a uid with a slash', async () => {
    await expect(
      removeOutgoingRequest({ currUID: CURR, friendUID: 'x/y' }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
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

    expect(getDocData(`userProfileData/${CURR}`)).toMatchObject({
      totalWorkouts: 3,
      totalExercises: 13,
    })
  })

  it('clamps and truncates the reported amounts', async () => {
    setDoc(`userProfileData/${CURR}`, { totalWorkouts: 0, totalExercises: 0 })

    await updateTotalWorkoutsAndExercises(
      { uid: CURR, numWorkouts: 1e9, numExercises: -2.7 },
      authContext
    )
    await updateTotalWorkoutsAndExercises(
      { uid: CURR, numWorkouts: 'abc', numExercises: Infinity },
      authContext
    )

    expect(getDocData(`userProfileData/${CURR}`)).toMatchObject({
      totalWorkouts: 1000,
      totalExercises: -2,
    })
  })

  it('does not throw or create a profile when there is none', async () => {
    await updateTotalWorkoutsAndExercises(
      { uid: CURR, numWorkouts: 1, numExercises: 1 },
      authContext
    )
    expect(docExists(`userProfileData/${CURR}`)).toBe(false)
  })
})

describe('updateActivity', () => {
  it('writes lastActive', async () => {
    setDoc(`userProfileData/${CURR}`, { lastActive: 1 })

    await updateActivity({ uid: CURR }, authContext)

    expect(getDocData(`userProfileData/${CURR}`).lastActive).toBeGreaterThan(1)
  })

  it('does not throw or create a profile when there is none', async () => {
    await updateActivity({ uid: CURR }, authContext)
    expect(docExists(`userProfileData/${CURR}`)).toBe(false)
  })
})

describe('getSuggestedFriends', () => {
  const seedUsers = (count: number) => {
    for (let i = 0; i < count; i++) {
      setDoc(`userProfileData/user-${i}`, {
        username: `user-${i}`,
        displayName: `User ${i}`,
        photoUrl: '',
        createdAt: 1,
        totalWorkouts: 0,
        totalExercises: 0,
        lastActive: 1000 - i,
        numFriends: 3,
      })
    }
  }

  it('skips the caller and anyone with a relation, and returns public fields', async () => {
    seedUsers(10)
    setDoc(`userProfileData/${CURR}`, { username: 'curr', lastActive: 5000 })
    setDoc(`userProfileData/${CURR}/${FRIENDS}/user-0`, {})
    setDoc(`userProfileData/${CURR}/${OUTGOING_FRIEND_REQUESTS}/user-1`, {})
    setDoc(`userProfileData/${CURR}/${INCOMING_FRIEND_REQUESTS}/user-2`, {})

    const result = await getSuggestedFriends({ uid: CURR }, authContext)

    expect(result.map((u: any) => u.username)).toEqual([
      'user-3',
      'user-4',
      'user-5',
      'user-6',
      'user-7',
      'user-8',
    ])
    expect(Object.keys(result[0]).sort()).toEqual(
      [
        'createdAt',
        'displayName',
        'lastActive',
        'photoUrl',
        'totalExercises',
        'totalWorkouts',
        'username',
      ].sort()
    )
  })

  it('stops after scanning 60 profiles', async () => {
    seedUsers(100)
    for (let i = 0; i < 100; i++) {
      setDoc(`userProfileData/${CURR}/${FRIENDS}/user-${i}`, {})
    }

    const result = await getSuggestedFriends({ uid: CURR }, authContext)

    expect(result).toEqual([])
    // 3 pages of 20 profiles, one getAll per page
    expect(h.getAllCalls).toBe(3)
    expect(h.reads).toBe(60 + 60 * 3)
  })
})

describe('getUsersFriendData', () => {
  it('combines the entries with public profile fields and drops missing profiles', async () => {
    setDoc(`userProfileData/${FRIEND}`, {
      username: 'friend-name',
      displayName: 'Friend',
      numFriends: 4,
    })

    const result = await getUsersFriendData(
      {
        usersFriendList: [
          { friendUID: FRIEND, friendUsername: 'friend-name', date: 1 },
          { friendUID: 'gone-uid', friendUsername: 'gone', date: 2 },
        ],
      },
      authContext
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      friendUID: FRIEND,
      friendUsername: 'friend-name',
      date: 1,
      username: 'friend-name',
      displayName: 'Friend',
    })
    expect(result[0]).not.toHaveProperty('numFriends')
    expect(h.getAllCalls).toBe(1)
  })

  it('returns an empty list for an empty input', async () => {
    expect(
      await getUsersFriendData({ usersFriendList: [] }, authContext)
    ).toEqual([])
  })

  it.each([
    ['too many entries', Array(51).fill({ friendUID: FRIEND })],
    ['a slash uid', [{ friendUID: 'a/b' }]],
    ['a missing uid', [{}]],
    ['not a list', 'nope'],
  ])('rejects %s', async (_name, usersFriendList) => {
    await expect(
      getUsersFriendData({ usersFriendList }, authContext)
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('email callables', () => {
  it.each([
    ['sendFriendRequestEmail', () => sendFriendRequestEmail],
    ['sendFriendAcceptedEmail', () => sendFriendAcceptedEmail],
  ])('%s writes nothing for a signed-in caller', async (_name, fn) => {
    await expect(
      fn()({ currUID: CURR, friendUID: FRIEND, currUsername: 'x' }, authContext)
    ).resolves.toBeNull()
    expect(h.store.docs.size).toBe(0)
  })

  it.each([
    ['sendFriendRequestEmail', () => sendFriendRequestEmail],
    ['sendFriendAcceptedEmail', () => sendFriendAcceptedEmail],
  ])('%s rejects a signed-out caller', async (_name, fn) => {
    await expect(fn()({}, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    })
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
    [
      'removeFriend',
      () => removeFriend({ currUID: CURR, friendUID: FRIEND }, otherContext),
    ],
    [
      'removeIncomingRequest',
      () =>
        removeIncomingRequest({ currUID: CURR, friendUID: FRIEND }, otherContext),
    ],
    ['getSuggestedFriends', () => getSuggestedFriends({ uid: CURR }, otherContext)],
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
})

describe('friend email html', () => {
  it('escapes the stored username', async () => {
    setDoc(`userProfileData/${CURR}`, { username: '<b>x</b>"' })
    setDoc(`userProfileData/${FRIEND}`, { username: 'friend-name' })

    await addFriend(friendRequestData(), authContext)

    const html = mailDocs()[0].message.html as string
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
