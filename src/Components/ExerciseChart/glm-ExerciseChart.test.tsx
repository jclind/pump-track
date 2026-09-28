import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExerciseChart from './ExerciseChart'
import { ExercisesServerDataType, TimePeriodType } from '../../types'

vi.mock('../../services/tracker', () => ({
  getSingleExercisePR: vi.fn(async () => undefined),
}))

// chart.js resize logic reads ResizeObserver, which jsdom does not provide
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver =
  (globalThis as any).ResizeObserver ?? ResizeObserverStub

const ChartHarness = ({
  exerciseData = null,
  timeSpan: initialTimeSpan = 'week',
  selectedExercise = null,
  loading = false,
}: {
  exerciseData?: ExercisesServerDataType[] | null
  timeSpan?: TimePeriodType
  selectedExercise?: { label: string; value: string } | null
  loading?: boolean
}) => {
  const [timeSpan, setTimeSpan] = useState<TimePeriodType>(initialTimeSpan)
  return (
    <ExerciseChart
      exerciseData={exerciseData}
      timeSpan={timeSpan}
      setTimeSpan={setTimeSpan}
      selectedExercise={selectedExercise}
      loading={loading}
    />
  )
}

const timeOption = (label: string) =>
  screen.getByRole('button', { name: label })

describe('ExerciseChart', () => {
  it('offers the five time ranges and marks the active one', () => {
    render(<ChartHarness />)

    // labels come from the first-letter match: w m 3m 6m y
    const labels = ['w', 'm', '3m', '6m', 'y']
    labels.forEach(label => expect(timeOption(label)).toBeTruthy())
    expect(timeOption('w')).toHaveClass('active')

    fireEvent.click(timeOption('y'))
    expect(timeOption('y')).toHaveClass('active')
    expect(timeOption('w')).not.toHaveClass('active')
  })

  it('asks for an exercise before any data is shown', () => {
    render(<ChartHarness />)
    expect(screen.getByText('Exercise Data Shown Here')).toBeTruthy()
  })

  it('shows the loading state in place of the chart', () => {
    render(<ChartHarness loading={true} />)
    expect(screen.getByText('Data Loading')).toBeTruthy()
  })

  it('reports no data when an exercise is selected but has no data', () => {
    render(
      <ChartHarness
        exerciseData={null}
        selectedExercise={{ label: 'Bench press', value: 'bench press' }}
      />
    )
    expect(screen.getByText('No Data!')).toBeTruthy()
  })
})
