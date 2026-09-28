import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks needed to load the two service modules whose bugs are suspected below.
// Every test in this file is skipped; the expectations describe the behavior
// the code should have, not what it does today.
// ---------------------------------------------------------------------------

const mail = vi.hoisted(() => ({ callableNames: [] as string[] }))

vi.mock('./services/firestore', () => ({
  auth: { currentUser: { uid: 'curr-uid' } },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('./services/auth', () => ({
  getUsername: async () => 'curr-name',
  getUIDFromUsername: async () => 'friend-uid',
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: (_fns: unknown, name: string) => {
    mail.callableNames.push(name)
    return async () => ({ data: {} })
  },
}))

// Minimal in-memory firestore so functions/src/index.ts can load
const fnMocks = vi.hoisted(() => {
  const docs = new Map<string, any>()
  const store = {
    docs,
    doc: (path: string) => ({
      get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
      set: async (data: any) => {
        docs.set(path, data)
      },
      delete: async () => {
        docs.delete(path)
      },
    }),
    collection: (path: string) => ({
      add: async (data: any) => {
        docs.set(`${path}/auto`, data)
      },
    }),
  }
  return { store }
})

vi.mock(
  '../functions/node_modules/firebase-functions/lib/esm/v1/index.mjs',
  () => ({
    https: {
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
      getUser: async (uid: string) => ({ uid, displayName: uid, email: `${uid}@x` }),
    })),
  })
)
vi.mock(
  '../functions/node_modules/firebase-admin/lib/esm/firestore/index.js',
  () => ({
    getFirestore: () => fnMocks.store,
    FieldValue: { increment: (n: number) => ({ __increment: n }) },
  })
)

import {
  convertToTimeNumber,
  formatChartData,
  getStepSize,
} from './util/chartUtil'
import { parseExercise } from './util/parseExercise'
import { addFriend } from '../functions/src/index'
import { acceptFriendRequest } from './services/friends'
import { ExercisesServerDataType } from './types'

const makeExercise = (
  weights: { weight: number }[],
  workoutDate: number
): ExercisesServerDataType =>
  ({
    id: 'id',
    index: 0,
    name: 'bench',
    originalString: '',
    weights: weights.map(w => ({ sets: [5], weight: w.weight, comment: '' })),
    workoutDate,
    workoutID: 'w1',
    maxWeight: Math.max(...weights.map(w => w.weight)),
  }) as ExercisesServerDataType

describe('suspected bugs', () => {
  // Input: convertToTimeNumber('3-month') / ('6-month') on 2026-09-28.
  // Expected: timestamps 3 / 6 months back (getStartOfDayArrayByPeriod spans 90 / 180 days for the same periods).
  // Actual: it subtracts 2 / 3 months, so the chart fetches less data than its x-axis displays. src/util/chartUtil.ts:23
  it.skip('convertToTimeNumber goes back 3 and 6 months for the 3-month and 6-month periods', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 28, 12, 0, 0))
    try {
      expect(convertToTimeNumber('3-month')).toBe(
        new Date(2026, 5, 28, 12, 0, 0).getTime()
      )
      expect(convertToTimeNumber('6-month')).toBe(
        new Date(2026, 2, 28, 12, 0, 0).getTime()
      )
    } finally {
      vi.useRealTimers()
    }
  })

  // Input: getStepSize(100, 160), i.e. y bounds 60 apart.
  // Expected: 10 (a step that grows with the range).
  // Actual: min - max is negative, so the range check always picks 5 and the y-axis never widens. src/util/chartUtil.ts:219
  it.skip('getStepSize scales the step with the distance between bounds', () => {
    expect(getStepSize(100, 120)).toBe(5)
    expect(getStepSize(100, 160)).toBe(10)
    expect(getStepSize(100, 210)).toBe(15)
    expect(getStepSize(100, 300)).toBe(20)
  })

  // Input: acceptFriendRequest('sam') in the client, after accepting a request.
  // Expected: the cloud function 'sendFriendAcceptedEmail' is invoked.
  // Actual: it invokes 'sendFriendRequestEmail', and sendFriendAcceptedEmail (functions/src/index.ts:153) is never called by anything. src/services/friends.ts:102
  it.skip('accepting a friend request sends the accepted email, not the request email', async () => {
    mail.callableNames.length = 0
    await acceptFriendRequest('sam')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mail.callableNames).toContain('sendFriendAcceptedEmail')
    expect(mail.callableNames).not.toContain('sendFriendRequestEmail')
  })

  // Input: addFriend({currUID, friendUID, friendUsername}) with currUsername missing.
  // Expected: rejected with invalid-argument (the other params are validated).
  // Actual: friendUsername is checked twice and currUsername never, so the friend's incoming request is stored with friendUsername: undefined. functions/src/index.ts:378
  it.skip('addFriend rejects a request that is missing currUsername', async () => {
    await expect(
      addFriend(
        { currUID: 'curr-uid', friendUID: 'friend-uid', friendUsername: 'f' },
        { auth: { uid: 'curr-uid' } }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  // Input: parseExercise('deadlifts 100lbs 3x8') — weight typed with its unit.
  // Expected: weight 100; the .replaceAll('[^\\d.]', '') on the weight shows the intent to strip non-digits.
  // Actual: that replace is a string literal, not a regex, so it strips nothing and Number('100lbs') is NaN. src/util/parseExercise.ts:54
  it.skip('parseExercise strips non-digits from the weight instead of producing NaN', () => {
    expect(parseExercise('deadlifts 100lbs 3x8').weights[0].weight).toBe(100)
  })

  // Input: formatChartData with two bench entries on one day: [100, 200] (total 300, max 200) and [250] (total 250, max 250).
  // Expected: the day plots 250, its heaviest weight (the code comment says "find exercise with largest weight").
  // Actual: the entry is picked by total weight, so the day plots 200 and the 250 lift vanishes from the chart. src/util/chartUtil.ts:144
  it.skip('formatChartData plots the heaviest weight of the day', () => {
    const day = new Date(2026, 5, 10).getTime()
    const result = formatChartData([
      makeExercise([{ weight: 100 }, { weight: 200 }], day),
      makeExercise([{ weight: 250 }], day),
    ])
    expect(result.formattedData[0].y).toBe(250)
  })
})
