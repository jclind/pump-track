import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Modal from 'react-modal'
import Footer from './Footer'

const mocks = vi.hoisted(() => ({
  importWorkouts: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('../../services/tracker', () => ({
  importWorkouts: mocks.importWorkouts,
}))
vi.mock('react-hot-toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

Modal.setAppElement(document.createElement('div'))

const openAndImport = (text: string) => {
  fireEvent.click(screen.getByText('import workouts'))
  fireEvent.change(document.querySelector('.import-input')!, {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Import' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Footer import', () => {
  it('stops the spinner and shows a text error when the import fails', async () => {
    mocks.importWorkouts.mockRejectedValue(new Error('permission-denied'))
    render(<Footer setWorkoutList={() => {}} />)

    openAndImport('Push 3/15/2024\nbench 135 5')

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Import failed: permission-denied',
        expect.anything()
      )
    )
    expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy()
  })

  it('does not call the server when no workout has a title', () => {
    render(<Footer setWorkoutList={() => {}} />)

    openAndImport('\r\n\r\n   \r\n')

    expect(mocks.importWorkouts).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalled()
  })

  it('sends one workout per blank-line chunk with Windows line endings', async () => {
    mocks.importWorkouts.mockImplementation(async workouts => workouts)
    render(<Footer setWorkoutList={() => {}} />)

    openAndImport('Push\r\nbench 135 5\r\n\r\nPull\r\nrows 100 5\r\n')

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
    const sent = mocks.importWorkouts.mock.calls[0][0]
    expect(sent.map((w: { name: string }) => w.name)).toEqual(['push', 'pull'])
  })
})
