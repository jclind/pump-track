import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FriendStatusButton from './FriendStatusButton'
import { FriendsStatusType } from '../../types'

vi.mock('../../services/friends', () => ({
  addFriend: vi.fn(async () => {}),
  acceptFriendRequest: vi.fn(async () => {}),
  removeOutgoingRequest: vi.fn(async () => {}),
}))

const StatusHarness = ({ initial }: { initial: FriendsStatusType }) => {
  const [status, setStatus] = useState<FriendsStatusType | null>(initial)
  if (!status) return <div>reset</div>
  return (
    <FriendStatusButton
      friendshipStatus={status}
      setFriendshipStatus={setStatus as React.Dispatch<
        React.SetStateAction<FriendsStatusType>
      >}
      accountUsername='sam'
    />
  )
}

describe('FriendStatusButton', () => {
  it('offers to add a friend and flips to requested on click', async () => {
    render(<StatusHarness initial='not_friends' />)
    expect(screen.getByRole('button')).toHaveTextContent('add friend')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('requested')
  })

  it('cancels an outgoing request on click', async () => {
    render(<StatusHarness initial='outgoing' />)
    expect(screen.getByRole('button')).toHaveTextContent('requested')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('add friend')
  })

  it('accepts an incoming request on click', async () => {
    render(<StatusHarness initial='incoming' />)
    expect(screen.getByRole('button')).toHaveTextContent('accept request')

    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('button')).toHaveTextContent('friends')
  })

  it('does nothing when already friends', () => {
    render(<StatusHarness initial='friends' />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('friends')
  })
})
