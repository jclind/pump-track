import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as Sentry from '@sentry/react'
import ErrorFallback from './ErrorFallback'

const Broken = (): React.ReactElement => {
  throw new Error('render failed')
}

describe('ErrorFallback', () => {
  it('replaces a crashed app with a message and a reload button', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    const realLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload },
    })
    try {
      render(
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <Broken />
        </Sentry.ErrorBoundary>
      )
      expect(screen.getByText('Something went wrong')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      })
      consoleError.mockRestore()
    }
  })
})
