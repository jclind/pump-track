import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Account from './Account'
import { getFriendshipStatus } from '../../services/friends'
import toast from 'react-hot-toast'

// LastWorkout imports the tracker service, which reaches Firebase
vi.mock('../../services/firestore', () => ({
  auth: { currentUser: null },
  db: {},
  firebaseFunctions: {},
}))
vi.mock('../../services/auth', () => ({
  getUserData: vi.fn(async () => null),
  getUsername: vi.fn(async () => 'sam'),
}))
vi.mock('../../services/friends', () => ({
  getFriendshipStatus: vi.fn(async () => 'not_friends'),
  getNumberOfFriends: vi.fn(async () => 0),
}))
vi.mock('../../Components/NoDataAnimation/NoDataAnimation', () => ({
  default: () => null,
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

describe('Account', () => {
  it('shows User not found for an unknown username', async () => {
    render(
      <MemoryRouter initialEntries={['/user/nobody']}>
        <Routes>
          <Route path='/user/:username' element={<Account />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('User not found')).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/'
    )
    expect(screen.queryByText(/add friend/i)).toBeNull()
    expect(getFriendshipStatus).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
