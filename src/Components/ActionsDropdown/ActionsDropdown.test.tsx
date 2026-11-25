import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionsDropdown from './ActionsDropdown'

const renderDropdown = (action: () => void, confirm: boolean) =>
  render(
    <ActionsDropdown
      buttons={[
        {
          text: 'Delete',
          icon: <span />,
          type: 'danger',
          confirm,
          action,
        },
      ]}
    />
  )

describe('ActionsDropdown', () => {
  it('runs an action right away when it needs no confirmation', () => {
    const action = vi.fn()
    renderDropdown(action, false)

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Delete'))

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('asks for Confirm before running a confirm action', () => {
    const action = vi.fn()
    renderDropdown(action, true)

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Delete'))
    expect(action).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm'))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Confirm')).toBeNull()
  })

  it('goes back to the plain button on Cancel', () => {
    const action = vi.fn()
    renderDropdown(action, true)

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(action).not.toHaveBeenCalled()
    expect(screen.getByText('Delete')).toBeTruthy()
  })
})
