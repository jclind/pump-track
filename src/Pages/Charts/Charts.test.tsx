import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Charts from './Charts'
import { ExerciseSelectType } from '../../types'

const mocks = vi.hoisted(() => ({
  queryChartExerciseData: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../../services/tracker', () => ({
  getUniqueTitles: async () => ['bench'],
  queryChartExerciseData: mocks.queryChartExerciseData,
}))
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }))

vi.mock('../../Components/ChartSelect/ChartSelect', () => ({
  default: ({
    setSelectedOption,
  }: {
    setSelectedOption: (option: ExerciseSelectType) => void
  }) => (
    <button onClick={() => setSelectedOption({ label: 'bench', value: 'bench' })}>
      pick bench
    </button>
  ),
}))
vi.mock('../../Components/ExerciseChart/ExerciseChart', () => ({
  default: ({ loading }: { loading: boolean }) => (
    <div>{loading ? 'loading' : 'idle'}</div>
  ),
}))

describe('Charts', () => {
  it('clears the spinner and shows a text error when the query fails', async () => {
    mocks.queryChartExerciseData.mockRejectedValue(new Error('index missing'))
    render(<Charts />)

    fireEvent.click(screen.getByText('pick bench'))

    await waitFor(() => expect(screen.getByText('idle')).toBeTruthy())
    expect(mocks.toastError).toHaveBeenCalledWith('index missing', {
      position: 'bottom-center',
    })
  })
})
