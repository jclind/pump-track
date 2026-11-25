import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deleteWorkout,
  getWorkouts,
  importWorkouts,
  updateExercise,
  updateUniqueTitles,
  updateWorkout,
} from './tracker'
import { parseExercise } from '../util/parseExercise'
import { ExercisesServerDataType, WorkoutDataType } from '../types'

// A small in-memory Firestore: documents keyed by path, queries that
// understand where('==' / '>='), and batches that record their size.
const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>
  const docs = new Map<string, Data>()
  const batchSizes: number[] = []
  const state = { failCommit: false }

  type Ref = { path: string }
  type Constraint = { kind: string; field?: string; op?: string; value?: unknown }
  type Query = Ref & { constraints: Constraint[] }

  const snapshot = (path: string) => ({
    id: path.split('/').pop(),
    ref: { path },
    exists: () => docs.has(path),
    data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
  })

  const runQuery = (q: Query) => {
    const prefix = q.path + '/'
    const matches = [...docs.keys()]
      .filter(
        path =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes('/')
      )
      .filter(path =>
        (q.constraints || []).every(c => {
          if (c.kind !== 'where') return true
          const value = docs.get(path)![c.field!]
          if (c.op === '==') return value === c.value
          if (c.op === '>=') return (value as number) >= (c.value as number)
          return true
        })
      )
      .map(snapshot)
    return {
      docs: matches,
      size: matches.length,
      forEach: (fn: (d: ReturnType<typeof snapshot>) => void) =>
        matches.forEach(fn),
    }
  }

  const setDoc = async (ref: Ref, data: Data, opts?: { merge?: boolean }) => {
    const prev = opts?.merge ? docs.get(ref.path) || {} : {}
    docs.set(ref.path, { ...prev, ...data })
  }
  const updateDoc = async (ref: Ref, data: Data) => {
    if (!docs.has(ref.path)) throw new Error(`No document to update: ${ref.path}`)
    docs.set(ref.path, { ...docs.get(ref.path), ...data })
  }

  return {
    docs,
    batchSizes,
    state,
    module: {
      collection: (parent: Ref, name: string) => ({
        path: `${parent.path}/${name}`,
        constraints: [],
      }),
      doc: (parent: Ref | object, ...segments: string[]) => {
        const base = (parent as Ref).path ? `${(parent as Ref).path}/` : ''
        return { path: base + segments.join('/') }
      },
      query: (base: Query, ...constraints: Constraint[]) => ({
        path: base.path,
        constraints: [...(base.constraints || []), ...constraints],
      }),
      where: (field: string, op: string, value: unknown) => ({
        kind: 'where',
        field,
        op,
        value,
      }),
      orderBy: () => ({ kind: 'orderBy' }),
      limit: () => ({ kind: 'limit' }),
      startAfter: () => ({ kind: 'startAfter' }),
      getDoc: async (ref: Ref) => snapshot(ref.path),
      getDocs: async (q: Query) => runQuery(q),
      getCountFromServer: async (q: Query) => ({
        data: () => ({ count: runQuery(q).size }),
      }),
      setDoc,
      updateDoc,
      deleteDoc: async (ref: Ref) => {
        docs.delete(ref.path)
      },
      writeBatch: () => {
        const ops: (() => void)[] = []
        return {
          set: (ref: Ref, data: Data) =>
            ops.push(() => docs.set(ref.path, { ...data })),
          delete: (ref: Ref) => ops.push(() => docs.delete(ref.path)),
          commit: async () => {
            if (state.failCommit) throw new Error('permission-denied')
            batchSizes.push(ops.length)
            ops.forEach(op => op())
          },
        }
      },
      runTransaction: async (_db: unknown, fn: (t: unknown) => Promise<void>) =>
        fn({
          get: async (ref: Ref) => snapshot(ref.path),
          set: (ref: Ref, data: Data) => setDoc(ref, data),
          update: (ref: Ref, data: Data) => updateDoc(ref, data),
        }),
    },
  }
})

vi.mock('firebase/firestore', () => fake.module)
vi.mock('./firestore', () => ({
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('./auth', () => ({ updateUserActivity: async () => {} }))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async () => ({}),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

type TitleCounts = Record<string, number>
const userDoc = () =>
  fake.docs.get('usersData/u1') as
    | { workoutTitles?: TitleCounts; exerciseTitles?: TitleCounts }
    | undefined
const exerciseDocs = () =>
  [...fake.docs.entries()]
    .filter(([path]) => path.startsWith('usersData/u1/exercises/'))
    .map(([, data]) => data as ExercisesServerDataType)
const workoutDoc = (id: string) =>
  fake.docs.get(`usersData/u1/workouts/${id}`) as WorkoutDataType | undefined

const workout = (
  name: string,
  lines: string[],
  date: number | null = new Date(2026, 9, 1).getTime()
): WorkoutDataType => {
  const id = `w-${name}-${lines.length}-${date}`
  return {
    id,
    name,
    date,
    exercises: lines.map((line, i) => parseExercise(line, `${id}-ex-${i}`)),
  }
}

beforeEach(() => {
  fake.docs.clear()
  fake.batchSizes.length = 0
  fake.state.failCommit = false
})

describe('updateUniqueTitles', () => {
  it('creates the user doc when it does not exist yet', async () => {
    await updateUniqueTitles('workoutTitles', 'Push')

    expect(userDoc()).toEqual({ workoutTitles: { push: 1 } })
  })

  it('lowercases and trims titles passed as an array', async () => {
    await updateUniqueTitles('exerciseTitles', [' Bench ', 'BENCH', 'Rows'])
    await updateUniqueTitles('exerciseTitles', null, ['bench ', ' ROWS'])

    expect(userDoc()!.exerciseTitles).toEqual({ bench: 1 })
  })
})

describe('importWorkouts', () => {
  it('stores workouts, exercises, and title counts in one pass', async () => {
    const result = await importWorkouts([
      workout('Push', ['Bench 135 3x5', 'dips 0 3x10']),
      workout('push', ['bench 140 3x5']),
    ])

    expect(result.map(w => w.name)).toEqual(['push', 'push'])
    expect(userDoc()!.workoutTitles).toEqual({ push: 2 })
    expect(userDoc()!.exerciseTitles).toEqual({ bench: 2, dips: 1 })
    expect(exerciseDocs()).toHaveLength(3)
    expect(exerciseDocs().every(ex => ex.name === ex.name.toLowerCase())).toBe(
      true
    )
  })

  it('gives a dateless workout and its exercises the same timestamp', async () => {
    const [stored] = await importWorkouts([
      workout('legs', ['squat 225 5'], null),
    ])

    expect(stored.date).toEqual(expect.any(Number))
    expect(workoutDoc(stored.id)!.date).toBe(stored.date)
    expect(exerciseDocs()[0].workoutDate).toBe(stored.date)
  })

  it('writes in batches under the 500 write limit', async () => {
    const lines = Array.from({ length: 300 }, (_, i) => `curl ${i} 10`)
    await importWorkouts([workout('a', lines), workout('b', lines)])

    expect(fake.batchSizes.length).toBeGreaterThan(1)
    expect(Math.max(...fake.batchSizes)).toBeLessThan(500)
    expect(fake.batchSizes.reduce((a, b) => a + b, 0)).toBe(602)
  })

  it('refuses input with no titled workout and writes nothing', async () => {
    await expect(
      importWorkouts([workout('  ', ['bench 100 5'])])
    ).rejects.toThrow('No workouts with a title found')
    expect(fake.docs.size).toBe(0)
  })

  it('rejects when a write fails', async () => {
    fake.state.failCommit = true

    await expect(
      importWorkouts([workout('push', ['bench 1 1'])])
    ).rejects.toThrow('permission-denied')
  })
})

describe('deleteWorkout', () => {
  it('deletes the exercises and takes the titles out of the counts', async () => {
    const [push] = await importWorkouts([
      workout('push', ['bench 135 5', 'dips 0 10']),
      workout('push', ['bench 140 5'], new Date(2026, 9, 2).getTime()),
    ])

    await deleteWorkout(push.id)

    expect(fake.docs.has(`usersData/u1/workouts/${push.id}`)).toBe(false)
    expect(exerciseDocs()).toHaveLength(1)
    expect(userDoc()!.workoutTitles).toEqual({ push: 1 })
    expect(userDoc()!.exerciseTitles).toEqual({ bench: 1 })
  })

  it('rejects when the delete fails, so the UI does not report success', async () => {
    const [push] = await importWorkouts([workout('push', ['bench 135 5'])])
    fake.state.failCommit = true

    await expect(deleteWorkout(push.id)).rejects.toThrow('permission-denied')
    expect(userDoc()!.workoutTitles).toEqual({ push: 1 })
  })
})

describe('updateExercise', () => {
  it('lowercases the name, recomputes maxWeight, and moves the title count', async () => {
    const [stored] = await importWorkouts([workout('push', ['bench 135 5'])])
    const edited = parseExercise(
      'Incline Bench 155 5 / 165 3',
      stored.exercises[0].id
    )

    const list = await updateExercise(stored, edited)

    const [exerciseDoc] = exerciseDocs()
    expect(exerciseDoc.name).toBe('incline bench')
    expect(exerciseDoc.maxWeight).toBe(165)
    expect(list[0].originalString).toBe('Incline Bench 155 5 / 165 3')
    expect(workoutDoc(stored.id)!.exercises[0].originalString).toBe('Incline Bench 155 5 / 165 3')
    expect(userDoc()!.exerciseTitles).toEqual({ 'incline bench': 1 })
  })

  it('removes the exercises doc when the new text has no name', async () => {
    const [stored] = await importWorkouts([workout('push', ['bench 135 5'])])

    await updateExercise(
      stored,
      parseExercise('135 5', stored.exercises[0].id)
    )

    expect(exerciseDocs()).toHaveLength(0)
    expect(userDoc()!.exerciseTitles).toEqual({})
  })

  it('creates the exercises doc when a nameless line gets a name', async () => {
    const [stored] = await importWorkouts([workout('push', ['135 5'])])
    expect(exerciseDocs()).toHaveLength(0)

    await updateExercise(stored, parseExercise('bench 135 5', stored.exercises[0].id))

    expect(exerciseDocs()).toEqual([
      expect.objectContaining({
        name: 'bench',
        workoutID: stored.id,
        workoutDate: stored.date,
        index: 0,
        maxWeight: 135,
      }),
    ])
    expect(userDoc()!.exerciseTitles).toEqual({ bench: 1 })
  })
})

describe('updateWorkout', () => {
  it('stores a renamed title lowercased and trimmed', async () => {
    const [stored] = await importWorkouts([workout('push', ['bench 135 5'])])

    await updateWorkout(stored, { name: '  Push Day ' })

    expect(workoutDoc(stored.id)!.name).toBe('push day')
    expect(userDoc()!.workoutTitles).toEqual({ 'push day': 1 })
  })
})

describe('getWorkouts', () => {
  it('counts only the workouts that match the name filter', async () => {
    await importWorkouts([
      workout('push', ['bench 135 5']),
      workout('pull', ['rows 100 5']),
      workout('pull', ['rows 105 5'], new Date(2026, 9, 3).getTime()),
    ])

    const res = await getWorkouts(15, null, 'push')

    expect(res!.totalResults).toBe(1)
    expect(res!.data.map(w => w.name)).toEqual(['push'])
  })
})
