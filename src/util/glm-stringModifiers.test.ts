import { describe, it, expect } from 'vitest'
import {
  removeTextAfterSubstring,
  removeTextBeforeSubstring,
} from './stringModifiers'

describe('removeTextBeforeSubstring', () => {
  it('returns the text after the substring', () => {
    expect(removeTextBeforeSubstring('bench press', 'bench')).toBe(' press')
  })

  it('uses the first occurrence of the substring', () => {
    expect(removeTextBeforeSubstring('banana split', 'an')).toBe('ana split')
  })

  it('returns an empty string when the substring is absent', () => {
    expect(removeTextBeforeSubstring('bench press', 'squat')).toBe('')
  })
})

describe('removeTextAfterSubstring', () => {
  it('returns the text up to and including the substring', () => {
    expect(removeTextAfterSubstring('bench press', 'bench')).toBe('bench')
  })

  it('uses the first occurrence of the substring', () => {
    expect(removeTextAfterSubstring('banana split', 'an')).toBe('ban')
  })

  it('returns an empty string when the substring is absent', () => {
    expect(removeTextAfterSubstring('bench press', 'squat')).toBe('')
  })
})
