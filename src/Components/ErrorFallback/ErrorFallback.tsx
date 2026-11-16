import React from 'react'

// Shown by the error boundary in index.tsx in place of the whole app.
const ErrorFallback = () => {
  return (
    <div className='App'>
      <div className='login-container'>
        <h1>Something went wrong</h1>
        <button
          className='submit-btn'
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  )
}

export default ErrorFallback
