import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KarmaIndicator } from '../karma-indicator'

describe('KarmaIndicator', () => {
  it('renders with score', () => {
    render(<KarmaIndicator score={90} />)
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('shows "Alto" for score >= 80', () => {
    render(<KarmaIndicator score={90} />)
    expect(screen.getByText('Alto')).toBeInTheDocument()
  })

  it('shows "Medio" for score between 50-79', () => {
    render(<KarmaIndicator score={65} />)
    expect(screen.getByText('Medio')).toBeInTheDocument()
  })

  it('shows "Basso" for score < 50', () => {
    render(<KarmaIndicator score={40} />)
    expect(screen.getByText('Basso')).toBeInTheDocument()
  })

  it('renders small size', () => {
    render(<KarmaIndicator score={90} size="sm" />)
    const scoreEl = screen.getByText('90')
    expect(scoreEl.closest('div')).toHaveClass('w-8', 'h-8', 'text-sm')
  })

  it('renders medium size by default', () => {
    render(<KarmaIndicator score={90} />)
    const scoreEl = screen.getByText('90')
    expect(scoreEl.closest('div')).toHaveClass('w-12', 'h-12', 'text-lg')
  })

  it('renders large size', () => {
    render(<KarmaIndicator score={90} size="lg" />)
    const scoreEl = screen.getByText('90')
    expect(scoreEl.closest('div')).toHaveClass('w-16', 'h-16', 'text-2xl')
  })

  it('shows Karma label', () => {
    render(<KarmaIndicator score={90} />)
    expect(screen.getByText('Karma')).toBeInTheDocument()
  })
})