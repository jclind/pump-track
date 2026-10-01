import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ExercisePR from './ExercisePR'
import { getSingleExercisePR } from '../../services/tracker'

vi.mock('../../services/tracker', () => ({
  getSingleExercisePR: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000

describe('ExercisePR', () => {
  beforeEach(() => {
    vi.mocked(getSingleExercisePR).mockReset()
  })

  it('renders the PR weight and its date', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * DAY)
    vi.mocked(getSingleExercisePR).mockResolvedValue({
      maxWeight: 225,
      workoutDate: threeDaysAgo.getTime(),
    })

    const { container } = render(<ExercisePR exerciseName='bench' />)

    expect(await screen.findByText('225lbs')).toBeTruthy()
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]
    const dateSpan = container.querySelector('.pr-date')
    expect(dateSpan).toHaveTextContent(
      `- ${dayNames[threeDaysAgo.getDay()]}`
    )
  })

  it('shows a placeholder instead of a weight when there is no PR', async () => {
    vi.mocked(getSingleExercisePR).mockResolvedValue({
      maxWeight: null,
      workoutDate: null,
    })

    const { container } = render(<ExercisePR exerciseName='bench' />)

    await waitFor(() =>
      expect(container.querySelector('.exercise-pr')).toBeTruthy()
    )
    expect(container.querySelector('.weight')).toBeNull()
  })

  it('renders nothing while the PR is still loading', () => {
    vi.mocked(getSingleExercisePR).mockReturnValue(new Promise(() => {}))

    const { container } = render(<ExercisePR exerciseName='bench' />)
    expect(container.querySelector('.exercise-pr')).toBeNull()
  })

  // ExerciseChart keeps one ExercisePR mounted and changes its prop.
  it('refetches when the exercise changes, and ignores the stale reply', async () => {
    let resolveBench!: (v: { maxWeight: number; workoutDate: number }) => void
    vi.mocked(getSingleExercisePR).mockImplementation(name =>
      name === 'bench'
        ? new Promise(res => (resolveBench = res))
        : Promise.resolve({ maxWeight: 315, workoutDate: Date.now() })
    )

    const { rerender } = render(<ExercisePR exerciseName='bench' />)
    rerender(<ExercisePR exerciseName='squat' />)
    expect(await screen.findByText('315lbs')).toBeTruthy()
    expect(getSingleExercisePR).toHaveBeenCalledWith('squat')

    // bench's slow reply lands after the switch and must not overwrite it.
    resolveBench({ maxWeight: 225, workoutDate: Date.now() })
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText('225lbs')).toBeNull()
    expect(screen.getByText('315lbs')).toBeTruthy()
  })
})
