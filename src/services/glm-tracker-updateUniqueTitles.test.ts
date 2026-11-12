import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateUniqueTitles } from './tracker'

const mockStore = vi.hoisted(() => ({ userData: {} as Record<string, any> }))

vi.mock('./firestore', () => ({
  auth: { currentUser: { uid: 'curr-uid' } },
  db: {},
  firebaseFunctions: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  deleteDoc: async () => {},
  doc: () => ({}),
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  getDoc: async () => ({ data: () => mockStore.userData }),
  getDocs: async () => ({ forEach: () => {}, docs: [] }),
  limit: () => ({}),
  orderBy: () => ({}),
  query: () => ({}),
  setDoc: async () => {},
  startAfter: () => ({}),
  updateDoc: async (_ref: unknown, data: Record<string, any>) => {
    Object.assign(mockStore.userData, data)
  },
  where: () => ({}),
}))

const titles = () => mockStore.userData.workoutTitles

describe('updateUniqueTitles', () => {
  beforeEach(() => {
    mockStore.userData = {}
  })

  it('counts a new title once, lowercased and trimmed', async () => {
    await updateUniqueTitles('workoutTitles', '  Leg Day ')

    expect(titles()).toEqual({ 'leg day': 1 })
  })

  it('increments the count when the same title is added again', async () => {
    mockStore.userData = { workoutTitles: { 'leg day': 1 } }

    await updateUniqueTitles('workoutTitles', 'Leg Day')

    expect(titles()).toEqual({ 'leg day': 2 })
  })

  it('drops a title only once its count reaches zero', async () => {
    mockStore.userData = { workoutTitles: { 'leg day': 1, push: 2 } }

    await updateUniqueTitles('workoutTitles', null, 'leg day')
    expect(titles()).toEqual({ push: 2 })

    await updateUniqueTitles('workoutTitles', null, 'Push')
    expect(titles()).toEqual({ push: 1 })

    await updateUniqueTitles('workoutTitles', null, 'push')
    expect(titles()).toEqual({})
  })

  it('handles arrays of added titles', async () => {
    await updateUniqueTitles('workoutTitles', ['leg day', 'push', 'leg day'])

    expect(titles()).toEqual({ 'leg day': 2, push: 1 })
  })

  it('writes to the requested field only', async () => {
    await updateUniqueTitles('exerciseTitles', 'bench')

    expect(mockStore.userData.exerciseTitles).toEqual({ bench: 1 })
    expect(mockStore.userData.workoutTitles).toBeUndefined()
  })
})
