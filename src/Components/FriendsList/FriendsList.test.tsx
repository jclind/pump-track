import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import toast from 'react-hot-toast'
import FriendsList from './FriendsList'
import {
  addFriend,
  cancelFriendRequest,
  getSuggestedFriends,
} from '../../services/friends'

vi.mock('../../services/friends', () => ({
  addFriend: vi.fn(async () => {}),
  cancelFriendRequest: vi.fn(async () => {}),
  getSuggestedFriends: vi.fn(async () => [
    {
      username: 'sam',
      displayName: 'Sam Smith',
      photoUrl: '',
      createdAt: 0,
      totalWorkouts: 0,
      totalExercises: 0,
    },
  ]),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

const renderList = () =>
  render(
    <MemoryRouter>
      <FriendsList />
    </MemoryRouter>
  )

describe('suggested friends', () => {
  it('flips Add to Requested', async () => {
    renderList()
    fireEvent.click(await screen.findByText('Add'))
    expect(screen.getByText('Requested')).toBeTruthy()
    expect(addFriend).toHaveBeenCalledWith('sam')
  })

  it('goes back to Add when the request fails', async () => {
    vi.mocked(addFriend).mockRejectedValueOnce(new Error('offline'))
    renderList()
    fireEvent.click(await screen.findByText('Add'))

    await waitFor(() => expect(screen.getByText('Add')).toBeTruthy())
    expect(toast.error).toHaveBeenCalledWith('offline', expect.anything())
  })

  it('goes back to Requested when cancelling fails', async () => {
    vi.mocked(cancelFriendRequest).mockRejectedValueOnce(new Error('offline'))
    renderList()
    fireEvent.click(await screen.findByText('Add'))
    fireEvent.click(screen.getByText('Requested'))

    await waitFor(() => expect(screen.getByText('Requested')).toBeTruthy())
    expect(getSuggestedFriends).toHaveBeenCalledTimes(1)
  })
})
