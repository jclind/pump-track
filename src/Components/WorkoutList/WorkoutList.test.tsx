import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorkoutList from './WorkoutList'
import { WorkoutDataType } from '../../types'
import { parseExercise } from '../../util/parseExercise'

const mocks = vi.hoisted(() => ({
  getUniqueTitles: vi.fn(),
  getWorkouts: vi.fn(),
  updateExercise: vi.fn(),
  updateWorkout: vi.fn(),
  deleteWorkout: vi.fn(),
  toastError: vi.fn(),
  toastPromise: vi.fn(),
}))

vi.mock('../../services/tracker', () => ({
  getUniqueTitles: mocks.getUniqueTitles,
  getWorkouts: mocks.getWorkouts,
  updateExercise: mocks.updateExercise,
  updateWorkout: mocks.updateWorkout,
  deleteWorkout: mocks.deleteWorkout,
}))
vi.mock('react-hot-toast', () => ({
  default: { error: mocks.toastError, promise: mocks.toastPromise },
}))

const pushDay = (): WorkoutDataType => ({
  id: 'w1',
  name: 'push',
  date: new Date(2026, 9, 1).getTime(),
  exercises: [
    parseExercise('bench 135 5', 'e1'),
    parseExercise('dips 0 10', 'e2'),
  ],
})

const Harness = () => {
  const [workoutList, setWorkoutList] = useState<WorkoutDataType[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <WorkoutList
      workoutList={workoutList}
      setWorkoutList={setWorkoutList}
      loading={loading}
      setLoading={setLoading}
      currWorkoutTitle=''
    />
  )
}

// TextareaAutosize renders a hidden copy of each textarea for measuring.
const field = (value: string) => {
  const visible = screen
    .getAllByDisplayValue(value)
    .filter(el => el.getAttribute('aria-hidden') !== 'true')
  expect(visible).toHaveLength(1)
  return visible[0]
}

const editTextarea = (from: string, to: string) => {
  const textarea = field(from)
  fireEvent.focus(textarea)
  fireEvent.change(textarea, { target: { value: to } })
  fireEvent.blur(textarea)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUniqueTitles.mockResolvedValue(['push'])
  mocks.getWorkouts.mockResolvedValue({
    data: [pushDay()],
    lastDoc: null,
    totalResults: 1,
  })
  mocks.updateExercise.mockResolvedValue([])
  mocks.updateWorkout.mockResolvedValue(undefined)
})

describe('WorkoutList edits', () => {
  it('builds a second edit in the same workout on the first one', async () => {
    render(<Harness />)
    await screen.findByText('Past Workouts')

    editTextarea('bench 135 5', 'bench 140 5')
    editTextarea('dips 0 10', 'dips 25 10')

    expect(mocks.updateExercise).toHaveBeenCalledTimes(2)
    const [workoutSent, exerciseSent] = mocks.updateExercise.mock.calls[1]
    expect(workoutSent.exercises[0].originalString).toBe('bench 140 5')
    expect(exerciseSent.originalString).toBe('dips 25 10')
  })

  it('puts the old text back and shows a text error when the save fails', async () => {
    mocks.updateExercise.mockRejectedValue(new Error('offline'))
    render(<Harness />)
    await screen.findByText('Past Workouts')

    editTextarea('bench 135 5', 'bench 140 5')

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Edit not saved: offline',
        expect.anything()
      )
    )
    expect(field('bench 135 5')).toBeTruthy()
  })

  it('saves a renamed title lowercased', async () => {
    render(<Harness />)
    await screen.findByText('Past Workouts')

    const input = field('push')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Push Day' } })
    fireEvent.blur(input)

    expect(mocks.updateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1' }),
      { name: 'push day' }
    )
    expect(field('push day')).toBeTruthy()
  })
})

describe('WorkoutList delete', () => {
  it('needs a confirm and keeps the workout when the delete fails', async () => {
    mocks.deleteWorkout.mockRejectedValue(new Error('permission-denied'))
    render(<Harness />)
    await screen.findByText('Past Workouts')

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Delete'))
    expect(mocks.deleteWorkout).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm'))
    expect(mocks.deleteWorkout).toHaveBeenCalledWith('w1')
    await Promise.resolve()
    expect(field('bench 135 5')).toBeTruthy()
  })
})

describe('WorkoutList paging', () => {
  it('works out Load More for a new filter from the filtered results only', async () => {
    mocks.getWorkouts
      .mockResolvedValueOnce({ data: [pushDay()], lastDoc: null, totalResults: 1 })
      .mockResolvedValueOnce({ data: [pushDay()], lastDoc: null, totalResults: 2 })
    render(<Harness />)
    await screen.findByText('Past Workouts')
    expect(screen.queryByText('Load More')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'push' }))

    expect(await screen.findByText('Load More')).toBeTruthy()
    expect(mocks.getWorkouts.mock.calls[1][2]).toBe('push')
  })
})
