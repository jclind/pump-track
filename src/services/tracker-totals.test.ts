import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateTotalWorkoutsAndExercises } from './tracker'

const calls = vi.hoisted(() => [] as { numWorkouts: number; numExercises: number }[])

vi.mock('./firestore', () => ({
  auth: { currentUser: { uid: 'curr-uid' } },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('firebase/firestore', () => ({}))
vi.mock('./auth', () => ({ updateUserActivity: async () => {} }))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (data: { numWorkouts: number; numExercises: number }) => {
    calls.push(data)
  },
}))

describe('updateTotalWorkoutsAndExercises', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('sends a small change in one call', async () => {
    await updateTotalWorkoutsAndExercises(1, 6)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ numWorkouts: 1, numExercises: 6 })
  })

  it('splits a change over the per-call limit, so a big import is counted in full', async () => {
    await updateTotalWorkoutsAndExercises(1200, 2500)
    expect(calls.map(c => c.numWorkouts)).toEqual([1000, 200, 0])
    expect(calls.map(c => c.numExercises)).toEqual([1000, 1000, 500])
  })

  it('splits negative changes too', async () => {
    await updateTotalWorkoutsAndExercises(-1, -1500)
    expect(calls.map(c => c.numExercises)).toEqual([-1000, -500])
  })

  it('sends nothing for no change or a bad number', async () => {
    await updateTotalWorkoutsAndExercises(0, 0)
    await updateTotalWorkoutsAndExercises(NaN, NaN)
    expect(calls).toHaveLength(0)
  })
})
