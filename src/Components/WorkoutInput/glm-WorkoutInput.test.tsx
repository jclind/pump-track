import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutInput from './WorkoutInput'

describe('WorkoutInput', () => {
  it('keeps the typed title in the input', () => {
    render(<WorkoutInput />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Leg Day' } })

    expect(input).toHaveValue('Leg Day')
  })

  it('fades the filled title once the input loses focus', () => {
    render(<WorkoutInput />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'Leg Day' } })
    fireEvent.focus(input)
    expect(input).not.toHaveClass('fade')

    fireEvent.blur(input)
    expect(input).toHaveClass('fade')
    expect(screen.getByText('Workout Title')).toHaveClass('fade')
  })

  it('does not fade an empty title on blur', () => {
    render(<WorkoutInput />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.blur(input)

    expect(input).not.toHaveClass('fade')
  })
})
