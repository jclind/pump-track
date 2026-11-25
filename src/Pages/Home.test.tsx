import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { User } from 'firebase/auth'
import Home from './Home'

vi.mock('../Components/ExerciseList/ExerciseList', () => ({ default: () => null }))
vi.mock('../Components/WorkoutList/WorkoutList', () => ({ default: () => null }))
vi.mock('../Components/Footer/Footer', () => ({ default: () => null }))

describe('Home', () => {
  it('hides the loading overlay shortly after mounting', () => {
    vi.useFakeTimers()
    try {
      const setShowLoadingOverlay = vi.fn()
      render(
        <Home user={{} as User} setShowLoadingOverlay={setShowLoadingOverlay} />
      )
      expect(setShowLoadingOverlay).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(setShowLoadingOverlay).toHaveBeenCalledWith(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
