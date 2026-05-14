import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const condition = true
    expect(cn(condition && 'active', 'base')).toBe('active base')
  })

  it('handles false conditions', () => {
    const condition = false
    expect(cn(condition && 'active', 'base')).toBe('base')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles null and undefined', () => {
    expect(cn(null, 'foo', undefined, 'bar')).toBe('foo bar')
  })

  it('merges tailwind classes with same base', () => {
    expect(cn('px-2 p-4')).toBe('p-4')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })
})