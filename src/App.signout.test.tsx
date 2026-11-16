import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, vi } from 'vitest'
import toast from 'react-hot-toast'
import App from './App'
import { auth } from './services/firestore'
import { signupWithGoogle, updateUserActivity } from './services/auth'

let authListener: (user: any) => void = () => {}
let finishLookup = () => {}

vi.mock('./services/firestore', () => ({
  emulatorsOn: false,
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
  signupWithGoogle: vi.fn(async () => {}),
  updateUserActivity: vi.fn(),
}))
vi.mock('./Pages/Home', () => ({ default: () => <div>home</div> }))
vi.mock('./Components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  ;(auth as any).currentUser = null
})

const renderApp = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
const overlay = (container: HTMLElement) =>
  container.querySelector('.loading-overlay')!

test('a sign-in that finishes after a sign-out stays signed out', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  )
  const user = { uid: 'u1' }
  ;(auth as any).currentUser = user
  act(() => authListener(user))

  // The user signs out while the lookup waits
  ;(auth as any).currentUser = null
  act(() => authListener(null))

  await act(async () => finishLookup())
  expect(screen.queryByText('home')).toBeNull()
  expect(screen.getByText(/Sign In With Google/)).toBeTruthy()
  expect(updateUserActivity).not.toHaveBeenCalled()
})

test('a slow load hides the overlay without signing anyone out', () => {
  vi.useFakeTimers()
  const toastError = vi.spyOn(toast, 'error')
  const { container } = renderApp()
  expect(overlay(container)).toHaveClass('visible')

  act(() => vi.advanceTimersByTime(10000))
  expect(overlay(container)).toHaveClass('hidden')
  expect(toastError).toHaveBeenCalledWith(
    expect.any(String),
    expect.anything()
  )
})

test('the loading timeout never fires during sign-in', () => {
  vi.useFakeTimers()
  const toastError = vi.spyOn(toast, 'error')
  // The Google popup stays open
  vi.mocked(signupWithGoogle).mockReturnValueOnce(new Promise(() => {}))
  const { container } = renderApp()
  fireEvent.click(screen.getByText(/Sign In With Google/))

  act(() => vi.advanceTimersByTime(60000))
  expect(overlay(container)).toHaveClass('visible')
  expect(toastError).not.toHaveBeenCalled()
})

test('a failed sign-in shows a string, not an Error object', async () => {
  const toastError = vi.spyOn(toast, 'error')
  vi.mocked(signupWithGoogle).mockRejectedValueOnce(new Error('popup blocked'))
  renderApp()
  await act(async () => {
    fireEvent.click(screen.getByText(/Sign In With Google/))
  })
  expect(toastError).toHaveBeenCalledWith('popup blocked', expect.anything())
})

test('the login screen is titled Pump Track', () => {
  renderApp()
  expect(screen.getByRole('heading', { name: 'Pump Track' })).toBeTruthy()
})

test('an unknown path shows a not-found page with a link home', async () => {
  renderApp('/no/such/page')
  const user = { uid: 'u1' }
  ;(auth as any).currentUser = user
  act(() => authListener(user))
  await act(async () => finishLookup())

  expect(screen.getByText('Page not found')).toBeTruthy()
  expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
    'href',
    '/'
  )
})
