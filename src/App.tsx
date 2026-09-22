import { useEffect, useState } from 'react'
import Modal from 'react-modal'
import { auth } from './services/firestore'
import { AiFillGoogleCircle } from 'react-icons/ai'
import {
  getUsername,
  logout,
  signupWithGoogle,
  updateUserActivity,
} from './services/auth'
import { User } from 'firebase/auth'
import toast, { Toaster } from 'react-hot-toast'
import Lottie from 'lottie-react'
import loadingAnimationData from './assets/animations/page-loading.json'
import Home from './Pages/Home'
import { Route, Routes } from 'react-router-dom'
import Charts from './Pages/Charts/Charts'
import Layout from './Components/Layout/Layout'
import Account from './Pages/Account/Account'
import { PUMP_TRACK_LS_USERNAME } from './services/PUMP_TRACK_LS'
import Friends from './Pages/Friends/Friends'
import IncomingRequests from './Components/FriendsPage/IncomingRequests/IncomingRequests'
import OutgoingRequests from './Components/FriendsPage/OutgoingRequests/OutgoingRequests'

import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing({
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ['localhost', /^https:\/\/yourserver\.io\/api/],
    }),
    new Sentry.Replay(),
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

  useEffect(() => {
    const handleTimeout = () => {
      toast.error('Error Timeout, something went wrong. Try refreshing', {
        position: 'bottom-center',
      })
      logout()
      setShowLoadingOverlay(false)
    }

    const timeoutDuration = 10000

    if (showLoadingOverlay) {
      const timeoutId = setTimeout(() => {
        handleTimeout()
      }, timeoutDuration)

      // Cleanup the timeout if stateVariable changes before the timeout triggers
      return () => clearTimeout(timeoutId)
    }

    return () => {}
  }, [showLoadingOverlay])

  const handleSignup = () => {
    setLoginLoading(true)
    signupWithGoogle()
      .then(() => {
        setLoginLoading(false)
      })
      .catch(err => {
        toast.error(err, { position: 'bottom-center' })
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
          <Lottie animationData={loadingAnimationData} />
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
                <Charts />
              </Layout>
            }
          />
        </Routes>
      ) : (
        <div className='login-container'>
          <h1>Workout Tracker</h1>
          <button
            className='btn-no-styles google-signup-btn'
            onClick={handleSignup}
          >
            <AiFillGoogleCircle className='icon' /> Sign In With Google
          </button>
        </div>
      )}
    </div>
  )
}

export default App
