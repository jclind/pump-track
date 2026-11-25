import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FriendsList from './FriendsList'
import { getFriends } from '../../../services/friends'

const friend = (n: number) => ({
  friendUID: `uid-${n}`,
  friendUsername: `friend${n}`,
  username: `friend${n}`,
  displayName: `Friend ${n}`,
  photoUrl: '',
  date: 0,
  createdAt: 0,
  totalWorkouts: 0,
  totalExercises: 0,
})

vi.mock('../../../services/friends', () => ({
  getFriends: vi.fn(),
  removeFriend: vi.fn(),
}))
vi.mock('../../NoDataAnimation/NoDataAnimation', () => ({
  default: () => null,
}))

describe('FriendsList pagination', () => {
  it('stops the Load More spinner once the next page arrives', async () => {
    vi.mocked(getFriends)
      .mockResolvedValueOnce({
        friendsData: [friend(1)],
        numFriends: 3,
        lastDoc: null,
      } as never)
      .mockResolvedValueOnce({
        friendsData: [friend(2)],
        numFriends: 3,
        lastDoc: null,
      } as never)

    render(
      <MemoryRouter>
        <FriendsList setNumFriends={() => {}} />
      </MemoryRouter>
    )
    fireEvent.click(await screen.findByText('Load More'))

    expect(await screen.findByText('Friend 2')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Load More')).toBeEnabled())
  })
})
