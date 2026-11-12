import { describe, it, expect, vi, beforeEach } from 'vitest'

// The client half of the friend flows: which cloud function each action
// calls, and with what. firebase/functions is mocked to record both.
const calls = vi.hoisted(() => [] as { name: string; payload: unknown }[])

vi.mock('./firestore', () => ({
  auth: { currentUser: { uid: 'curr-uid' } },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('./auth', () => ({
  getUsername: async () => 'curr-name',
  getUIDFromUsername: async (username: string) => `uid-of-${username}`,
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: (_fns: unknown, name: string) => async (payload: unknown) => {
    calls.push({ name, payload })
    return { data: {} }
  },
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import { acceptFriendRequest, cancelFriendRequest } from './friends'

beforeEach(() => {
  calls.length = 0
  vi.useFakeTimers()
})

// Both actions wait 2s after the call; step past it.
const settle = async <T>(p: Promise<T>) => {
  await vi.runAllTimersAsync()
  return p
}

describe('cancelFriendRequest', () => {
  it('cancels by the friend\'s UID, resolved from their username', async () => {
    await settle(cancelFriendRequest('sam'))
    expect(calls).toEqual([
      {
        name: 'removeOutgoingRequest',
        payload: { currUID: 'curr-uid', friendUID: 'uid-of-sam' },
      },
    ])
  })
})

describe('acceptFriendRequest', () => {
  it('sends the accepted email, not the request email', async () => {
    await settle(acceptFriendRequest('sam'))
    await vi.runAllTimersAsync()
    const names = calls.map(c => c.name)
    expect(names).toContain('acceptFriendRequest')
    expect(names).toContain('sendFriendAcceptedEmail')
    expect(names).not.toContain('sendFriendRequestEmail')
  })
})
