import { describe, it, expect, vi, beforeEach } from 'vitest'

// The client half of the friend flows: which cloud function each action
// calls, and with what. firebase/functions is mocked to record both.
const calls = vi.hoisted(() => [] as { name: string; payload: unknown }[])
// When set, the next call with this name rejects with it
const failures = vi.hoisted(() => new Map<string, Error>())
const countCalls = vi.hoisted(() => ({ n: 0 }))

vi.mock('./firestore', () => ({
  auth: { currentUser: { uid: 'curr-uid' } },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('./auth', () => ({
  getUsername: async () => 'curr-name',
  getUIDFromUsername: async (username: string) =>
    username === 'ghost' ? null : `uid-of-${username}`,
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: (_fns: unknown, name: string) => async (payload: unknown) => {
    calls.push({ name, payload })
    const failure = failures.get(name)
    if (failure) {
      failures.delete(name)
      throw failure
    }
    return { data: [] }
  },
}))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  getCountFromServer: async () => {
    countCalls.n++
    return { data: () => ({ count: 3 }) }
  },
  getDocs: async () => ({ docs: [], forEach: () => {} }),
  limit: () => ({}),
  orderBy: () => ({}),
  query: () => ({}),
  startAfter: () => ({}),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import {
  acceptFriendRequest,
  addFriend,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  removeFriend,
  removeIncomingRequest,
} from './friends'

beforeEach(() => {
  calls.length = 0
  failures.clear()
  countCalls.n = 0
})

describe('cancelFriendRequest', () => {
  it("cancels by the friend's UID, resolved from their username", async () => {
    await cancelFriendRequest('sam')
    expect(calls).toEqual([
      {
        name: 'removeOutgoingRequest',
        payload: { currUID: 'curr-uid', friendUID: 'uid-of-sam' },
      },
    ])
  })
})

describe('acceptFriendRequest', () => {
  it('calls only acceptFriendRequest; the function sends the email', async () => {
    await acceptFriendRequest('sam')
    expect(calls.map(c => c.name)).toEqual(['acceptFriendRequest'])
  })
})

describe('addFriend', () => {
  it('calls only addFriend; the function sends the email', async () => {
    await addFriend('sam')
    expect(calls).toEqual([
      {
        name: 'addFriend',
        payload: {
          currUID: 'curr-uid',
          friendUID: 'uid-of-sam',
          currUsername: 'curr-name',
          friendUsername: 'sam',
        },
      },
    ])
  })

  it('rejects for an unknown user without calling the function', async () => {
    await expect(addFriend('ghost')).rejects.toThrow(/find that user/)
    expect(calls).toEqual([])
  })
})

// Each action waits for its function, so a failure reaches the button that
// started it.
describe.each([
  ['addFriend', () => addFriend('sam')],
  ['acceptFriendRequest', () => acceptFriendRequest('sam')],
  ['removeFriend', () => removeFriend('uid-of-sam')],
  ['removeIncomingRequest', () => removeIncomingRequest('sam')],
  ['removeOutgoingRequest', () => cancelFriendRequest('sam')],
])('%s', (name, action) => {
  it('rejects when the function fails', async () => {
    failures.set(name, new Error('offline'))
    await expect(action()).rejects.toThrow('offline')
  })
})

describe('friend counts', () => {
  it('counts friends for the friends list', async () => {
    const res = await getFriends()
    expect(res.numFriends).toBe(3)
    expect(countCalls.n).toBe(1)
  })

  it("doesn't count friends for request lists", async () => {
    await getIncomingFriendRequests()
    await getOutgoingFriendRequests()
    expect(countCalls.n).toBe(0)
  })
})
