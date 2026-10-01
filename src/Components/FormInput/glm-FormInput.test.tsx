import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FormInput from './FormInput'

const SuggestionHarness = () => {
  const [val, setVal] = useState('')
  return (
    <FormInput
      val={val}
      setVal={setVal}
      label='Exercise 1'
      suggestedText='bench press'
    />
  )
}

const EnterHarness = () => {
  const [entered, setEntered] = useState('none')
  return (
    <div>
      <FormInput
        val='ben'
        setVal={() => {}}
        label='Exercise 1'
        suggestedText='squat'
        nextID='next-input-id'
        onEnter={id => setEntered(id || 'null')}
      />
      <div data-testid='entered'>entered:{entered}</div>
    </div>
  )
}

const BackspaceHarness = () => {
  const [items, setItems] = useState(['first', 'second'])
  return (
    <div>
      <FormInput
        val=''
        setVal={() => {}}
        label='Exercise 1'
        onBackspaceEmpty={() => setItems(prev => prev.slice(0, -1))}
      />
      <div data-testid='items'>{items.join(',')}</div>
    </div>
  )
}

describe('FormInput', () => {
  it('completes the value from the suggestion on Enter', () => {
    render(<SuggestionHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'ben' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('bench press ')
  })

  it('completes the value from the suggestion on Tab', () => {
    render(<SuggestionHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'bench' } })
    fireEvent.keyDown(input, { key: 'Tab' })

    expect(input).toHaveValue('bench press ')
  })

  it('passes the next input id to onEnter when no suggestion matches', () => {
    render(<EnterHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByTestId('entered')).toHaveTextContent(
      'entered:next-input-id'
    )
  })

  it('signals the parent on Backspace when the input is empty', () => {
    render(<BackspaceHarness />)
    expect(screen.getByTestId('items')).toHaveTextContent('first,second')

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' })
    expect(screen.getByTestId('items')).toHaveTextContent('first')
  })

  it('clears the value with the clear button while focused', () => {
    const ClearHarness = () => {
      const [val, setVal] = useState('')
      return (
        <FormInput val={val} setVal={setVal} label='Exercise 1' />
      )
    }
    render(<ClearHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'deadlift' } })

    fireEvent.mouseDown(screen.getByRole('button'))
    expect(input).toHaveValue('')
  })

  it('shows the typed prefix faded out and the rest of the suggestion', () => {
    const OverlayHarness = () => {
      const [val, setVal] = useState('')
      return (
        <FormInput
          val={val}
          setVal={setVal}
          label='Exercise 1'
          suggestedText='bench press'
        />
      )
    }
    const { container } = render(<OverlayHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ben' } })

    const suggested = container.querySelector('.suggested-text')
    expect(suggested).not.toBeNull()
    const spans = suggested!.querySelectorAll('span')
    expect(spans[0]).toHaveTextContent('ben')
    expect(spans[1]).toHaveTextContent('ch press')
  })

  it('fades the label while the filled input is unfocused and un-fades it on focus', () => {
    const FadeHarness = () => {
      const [val, setVal] = useState('')
      return <FormInput val={val} setVal={setVal} label='Workout Title' />
    }
    render(<FadeHarness />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'Leg Day' } })
    expect(screen.getByText('Workout Title')).toHaveClass('fade')
    expect(input).toHaveClass('fade')

    fireEvent.focus(input)
    expect(screen.getByText('Workout Title')).not.toHaveClass('fade')
    expect(input).not.toHaveClass('fade')
  })
})
