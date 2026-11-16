import { Suspense, lazy, useEffect, useState } from 'react'
import Modal from 'react-modal'
import { auth, emulatorsOn } from './services/firestore'
import { AiFillGoogleCircle } from 'react-icons/ai'
import {
  getUsername,
  signupWithGoogle,
  updateUserActivity,
} from './services/auth'
import {
  SEEDED_TEST_ACCOUNTS,
  TestAccount,
  newTestAccount,
} from './services/testAccounts'
import { User } from 'firebase/auth'
import toast, { Toaster } from 'react-hot-toast'
import { Lottie } from 'lottie-react'
import loadingAnimationData from './assets/animations/page-loading.json'
import Home from './Pages/Home'
import { Route, Routes } from 'react-router-dom'
import Layout from './Components/Layout/Layout'
import Account from './Pages/Account/Account'
import { PUMP_TRACK_LS_USERNAME } from './services/PUMP_TRACK_LS'
import Friends from './Pages/Friends/Friends'
import IncomingRequests from './Components/FriendsPage/IncomingRequests/IncomingRequests'
import OutgoingRequests from './Components/FriendsPage/OutgoingRequests/OutgoingRequests'
import NotFound from './Components/NotFound/NotFound'

import * as Sentry from '@sentry/react'

// chart.js and moment are only needed here, so they load with this page.
const Charts = lazy(() => import('./Pages/Charts/Charts'))

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
})

Modal.setAppElement('#root')

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [loginLoading, setLoginLoading] = useState(false)

  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true)

  useEffect(() => {
    if (authLoading || loginLoading) {
      setShowLoadingOverlay(true)
    } else {
      setTimeout(() => {
        setShowLoadingOverlay(false)
      }, 100)
    }
  }, [authLoading, loginLoading])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(userInstance => {
      if (userInstance) {
        getUsername().then(() => {
          // The lookup can wait on a sign-up for seconds, and the user may
          // have signed out meanwhile.
          if (auth.currentUser?.uid !== userInstance.uid) return
          setUser(userInstance)
          updateUserActivity()
        })
      } else {
        setUser(null)
        localStorage.removeItem(PUMP_TRACK_LS_USERNAME)
      }
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Gives up on the overlay if loading hangs. Sign-in is left out: the Google
  // popup and a cold-starting setUsername can each take longer than this, and
  // the sign-in reports its own errors.
  useEffect(() => {
    if (!showLoadingOverlay || loginLoading) return
    const timeoutId = setTimeout(() => {
      toast.error('Loading is taking too long. Try refreshing.', {
        position: 'bottom-center',
      })
      setShowLoadingOverlay(false)
    }, 10000)
    return () => clearTimeout(timeoutId)
  }, [showLoadingOverlay, loginLoading])

  const handleSignup = (testAccount?: TestAccount) => {
    setLoginLoading(true)
    signupWithGoogle(testAccount)
      .then(() => {
        setLoginLoading(false)
      })
      .catch(err => {
        toast.error(err?.message || String(err), {
          position: 'bottom-center',
        })
        setLoginLoading(false)
      })
  }

  return (
    <div className='App'>
      <div
        className={`loading-overlay ${
          showLoadingOverlay ? 'visible' : 'hidden'
        }`}
      >
        <div className='animation'>
          <Lottie src={loadingAnimationData} autoplay loop />
        </div>
      </div>
      <Toaster />
      {user ? (
        <Routes>
          <Route
            path='/'
            element={
              <Layout>
                <Home
                  user={user}
                  setShowLoadingOverlay={setShowLoadingOverlay}
                />
              </Layout>
            }
          />

          <Route
            path='/user/:username'
            element={
              <Layout>
                <Account />
              </Layout>
            }
          />
          <Route
            path='user/:username/friends'
            element={
              <Layout>
                <Friends />
              </Layout>
            }
          >
            <Route path='incoming' element={<IncomingRequests />} />
            <Route path='outgoing' element={<OutgoingRequests />} />
          </Route>
          <Route
            path='/charts'
            element={
              <Layout>
                <Suspense fallback={null}>
                  <Charts />
                </Suspense>
              </Layout>
            }
          />
          <Route
            path='*'
            element={
              <Layout>
                <NotFound
                  title='Page not found'
                  message="There's nothing at this address."
                />
              </Layout>
            }
          />
        </Routes>
      ) : (
        <div className='login-container'>
          <h1>Pump Track</h1>
          <button
            className='btn-no-styles google-signup-btn'
            onClick={() => handleSignup()}
            disabled={loginLoading}
          >
            <AiFillGoogleCircle className='icon' /> Sign In With Google
          </button>
          {emulatorsOn && (
            <>
              {SEEDED_TEST_ACCOUNTS.map(account => (
                <button
                  key={account.sub}
                  className='btn-no-styles google-signup-btn'
                  onClick={() => handleSignup(account)}
                >
                  Sign in as {account.name}
                </button>
              ))}
              <button
                className='btn-no-styles google-signup-btn'
                onClick={() => handleSignup(newTestAccount())}
              >
                Sign up as a new test user
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
