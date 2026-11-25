import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExerciseList from './ExerciseList'

const mocks = vi.hoisted(() => ({
  addWorkout: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../../services/tracker', () => ({
  addWorkout: mocks.addWorkout,
  getCurrentWorkoutData: async () => ({
    workoutTitle: 'push',
    exercises: [{ id: 'a', text: 'bench 100 5' }],
  }),
  searchExercises: async () => undefined,
  updateCurrentWorkout: async () => {},
}))
vi.mock('react-hot-toast', () => ({ toast: { error: mocks.toastError } }))

const Harness = () => {
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  return (
    <ExerciseList
      setWorkoutList={() => {}}
      loading={loading}
      setLoading={setLoading}
      workoutTitle={title}
      setWorkoutTitle={setTitle}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExerciseList add workout', () => {
  it('clears the spinner without a second toast when addWorkout reports failure', async () => {
    // addWorkout shows its own error and resolves undefined.
    mocks.addWorkout.mockResolvedValue(undefined)
    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Workout' }))

    expect(
      await screen.findByRole('button', { name: 'Add Workout' })
    ).toBeTruthy()
    await waitFor(() => expect(mocks.addWorkout).toHaveBeenCalled())
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('shows a thrown error as text and clears the spinner', async () => {
    mocks.addWorkout.mockRejectedValue(new Error('offline'))
    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Workout' }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('offline', expect.anything())
    )
    expect(screen.getByRole('button', { name: 'Add Workout' })).toBeTruthy()
  })
})
