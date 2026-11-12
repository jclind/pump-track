import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FriendStatusButton from './FriendStatusButton'
import {
  addFriend,
  acceptFriendRequest,
  cancelFriendRequest,
} from '../../services/friends'
import { FriendsStatusType } from '../../types'

vi.mock('../../services/friends', () => ({
  addFriend: vi.fn(async () => {}),
  acceptFriendRequest: vi.fn(async () => {}),
  cancelFriendRequest: vi.fn(async () => {}),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

const StatusHarness = ({ initial }: { initial: FriendsStatusType }) => {
  const [status, setStatus] = useState<FriendsStatusType | null>(initial)
  if (!status) return <div>reset</div>
  return (
    <FriendStatusButton
      friendshipStatus={status}
      setFriendshipStatus={setStatus}
      accountUsername='sam'
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FriendStatusButton', () => {
  it('offers to add a friend and flips to requested on click', async () => {
    render(<StatusHarness initial='not_friends' />)
    expect(screen.getByRole('button')).toHaveTextContent('add friend')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('requested')
    expect(addFriend).toHaveBeenCalledWith('sam')
  })

  it('cancels an outgoing request on click', async () => {
    render(<StatusHarness initial='outgoing' />)
    expect(screen.getByRole('button')).toHaveTextContent('requested')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('add friend')
    // By username; cancelFriendRequest resolves the UID the cloud call needs.
    expect(cancelFriendRequest).toHaveBeenCalledWith('sam')
  })

  it('rolls back to requested when cancelling fails', async () => {
    vi.mocked(cancelFriendRequest).mockRejectedValueOnce('offline')
    render(<StatusHarness initial='outgoing' />)

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('requested')
    )
  })

  it('accepts an incoming request on click', async () => {
    render(<StatusHarness initial='incoming' />)
    expect(screen.getByRole('button')).toHaveTextContent('accept request')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('friends')
    expect(acceptFriendRequest).toHaveBeenCalledWith('sam')
  })

  it('does nothing when already friends', () => {
    render(<StatusHarness initial='friends' />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('friends')
    expect(addFriend).not.toHaveBeenCalled()
    expect(acceptFriendRequest).not.toHaveBeenCalled()
    expect(cancelFriendRequest).not.toHaveBeenCalled()
  })
})
