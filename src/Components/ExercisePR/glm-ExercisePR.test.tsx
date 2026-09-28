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
})
