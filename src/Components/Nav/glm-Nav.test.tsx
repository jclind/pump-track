import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './Nav'
import { logout } from '../../services/auth'

vi.mock('../../services/auth', () => ({
  getUsername: vi.fn(async () => 'sam'),
  logout: vi.fn(async () => {}),
}))

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid='location'>at:{location.pathname}</div>
}

// The page buttons are icon-only, so they are addressed by class
const click = (el: Element | null) => {
  if (!el) throw new Error('button not found')
  fireEvent.click(el)
}
const renderNav = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/']}>
      <Nav />
      <LocationProbe />
      <Routes>
        <Route path='*' element={<div>page</div>} />
      </Routes>
    </MemoryRouter>
  )
  // let the username load before interacting
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return result
}

describe('Nav', () => {
  it('renders the three page buttons and logout', async () => {
    const { container } = await renderNav()
    expect(container.querySelector('.home-btn')).toBeTruthy()
    expect(container.querySelector('.account-btn')).toBeTruthy()
    expect(container.querySelector('.exercise-charts-btn')).toBeTruthy()
    expect(screen.getByRole('button', { name: /logout/i })).toBeTruthy()
  })

  it('navigates to the charts page', async () => {
    const { container } = await renderNav()
    click(container.querySelector('.exercise-charts-btn'))
    expect(screen.getByTestId('location')).toHaveTextContent(/^at:\/charts$/)
  })

  it('navigates to the signed-in user page', async () => {
    const { container } = await renderNav()
    click(container.querySelector('.account-btn'))

    expect(screen.getByTestId('location')).toHaveTextContent(/^at:\/user\/sam$/)
  })

  it('logs out back to the home page', async () => {
    const { container } = await renderNav()
    click(container.querySelector('.account-btn'))

    expect(screen.getByTestId('location')).toHaveTextContent(/^at:\/user\/sam$/)

    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    // Exact match: 'at:/user/sam' also contains 'at:/'.
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^at:\/$/)
    )
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
