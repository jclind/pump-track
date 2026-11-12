import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UserCard from './UserCard'
import {
  acceptFriendRequest,
  removeFriend,
  removeIncomingRequest,
  removeOutgoingRequest,
} from '../../../services/friends'
import { CombinedFriendsData } from '../../../types'

vi.mock('../../../services/friends', () => ({
  removeIncomingRequest: vi.fn(async () => {}),
  acceptFriendRequest: vi.fn(async () => {}),
  removeFriend: vi.fn(async () => {}),
  removeOutgoingRequest: vi.fn(async () => {}),
}))

const user: CombinedFriendsData = {
  friendUID: 'friend-uid',
  friendUsername: 'sam',
  date: 0,
  createdAt: 0,
  displayName: 'Sam Smith',
  photoUrl: '',
  username: 'sam',
  totalWorkouts: 4,
  totalExercises: 20,
}

type CardType = 'incoming' | 'friend' | 'outgoing'

const removeFromList = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

// The service functions take different keys: the request ones resolve a
// username, the friend-list ones take a UID. The fixture's username ('sam')
// and UID ('friend-uid') differ, so a mix-up fails.
const Harness = ({
  type,
  initialFriends = 0,
}: {
  type: CardType
  initialFriends?: number
}) => {
  const [numIncoming, setNumIncoming] = useState<number | null>(1)
  const [numFriends, setNumFriends] = useState<number | null>(initialFriends)
  return (
    <MemoryRouter>
      <UserCard
        user={user}
        type={type}
        removeFromList={removeFromList}
        setNumIncoming={setNumIncoming}
        setNumFriends={setNumFriends}
      />
      <div data-testid='counts'>
        {numIncoming}:{numFriends}
      </div>
    </MemoryRouter>
  )
}

describe('UserCard', () => {
  it('shows the name and username of the user', () => {
    render(<Harness type='friend' />)
    expect(screen.getByText('Sam Smith')).toBeTruthy()
    expect(screen.getByText('(@sam)')).toBeTruthy()
  })

  it('accepts an incoming request, marking it added and adjusting counts', async () => {
    render(<Harness type='incoming' />)
    fireEvent.click(screen.getByText('Accept'))

    expect(await screen.findByText(/Friend Added/)).toBeTruthy()
    expect(await screen.findByTestId('counts')).toHaveTextContent('0:1')
    expect(acceptFriendRequest).toHaveBeenCalledWith('sam')
  })

  it('denies an incoming request and decrements the incoming count', async () => {
    render(<Harness type='incoming' />)
    fireEvent.click(screen.getByText('Deny'))

    expect(await screen.findByText(/Friend Denied/)).toBeTruthy()
    expect(await screen.findByTestId('counts')).toHaveTextContent('0:0')
    expect(removeIncomingRequest).toHaveBeenCalledWith('sam')
  })

  it('removes a friend only after confirming', async () => {
    render(<Harness type='friend' initialFriends={1} />)

    fireEvent.click(screen.getByText('Remove'))
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(screen.queryByText(/Removed/)).toBeNull()

    fireEvent.click(screen.getByText('Confirm'))
    expect(await screen.findByText(/Removed/)).toBeTruthy()
    expect(await screen.findByTestId('counts')).toHaveTextContent('1:0')
    expect(removeFriend).toHaveBeenCalledWith('friend-uid')
  })

  it('keeps a friend when the remove confirmation is cancelled', () => {
    render(<Harness type='friend' initialFriends={1} />)

    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText('Remove')).toBeTruthy()
    expect(screen.getByTestId('counts')).toHaveTextContent('1:1')
    expect(removeFriend).not.toHaveBeenCalled()
  })

  it('removes an outgoing request on click', async () => {
    render(<Harness type='outgoing' />)
    fireEvent.click(screen.getByText('Remove'))

    expect(await screen.findByText(/Removed/)).toBeTruthy()
    expect(removeOutgoingRequest).toHaveBeenCalledWith('friend-uid')
  })

  it('drops the card from its list by UID 3 seconds after the action', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<Harness type='outgoing' />)
      fireEvent.click(screen.getByText('Remove'))
      await waitFor(() => expect(removeOutgoingRequest).toHaveBeenCalled())

      await vi.advanceTimersByTimeAsync(2900)
      expect(removeFromList).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(200)
      expect(removeFromList).toHaveBeenCalledWith('friend-uid')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows skeletons instead of actions while loading', () => {
    render(
      <MemoryRouter>
        <UserCard user={null} type='friend' loading={true} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables the link when there is no user', () => {
    const { container } = render(
      <MemoryRouter>
        <UserCard user={null} type='friend' loading={false} />
      </MemoryRouter>
    )
    expect(container.querySelector('.user-card')).toHaveClass(
      'disabled-link'
    )
  })
})
