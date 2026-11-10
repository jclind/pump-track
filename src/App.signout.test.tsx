import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import { auth } from './services/firestore'
import { updateUserActivity } from './services/auth'

let authListener: (user: any) => void = () => {}
let finishLookup = () => {}

vi.mock('./services/firestore', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (cb: (user: any) => void) => {
      authListener = cb
      return () => {}
    },
  },
}))
// The lookup stays pending until the test finishes it, like a slow sign-up
vi.mock('./services/auth', () => ({
  getUsername: vi.fn(
    () =>
      new Promise<string>(resolve => {
        finishLookup = () => resolve('sam')
      })
  ),
  logout: vi.fn(async () => {}),
  signupWithGoogle: vi.fn(async () => {}),
  updateUserActivity: vi.fn(),
}))
vi.mock('./Pages/Home', () => ({ default: () => <div>home</div> }))
vi.mock('./Components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

test('a sign-in that finishes after a sign-out stays signed out', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  )
  const user = { uid: 'u1' }
  ;(auth as any).currentUser = user
  act(() => authListener(user))

  // The loading timeout signs the user out while the lookup waits
  ;(auth as any).currentUser = null
  act(() => authListener(null))

  await act(async () => finishLookup())
  expect(screen.queryByText('home')).toBeNull()
  expect(screen.getByText(/Sign In With Google/)).toBeTruthy()
  expect(updateUserActivity).not.toHaveBeenCalled()
})
