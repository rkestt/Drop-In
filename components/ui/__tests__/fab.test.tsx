import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickCreateFAB } from '../fab'

describe('QuickCreateFAB', () => {
  it('renders button', () => {
    render(<QuickCreateFAB onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onClick when button clicked', () => {
    const onClick = vi.fn()
    render(<QuickCreateFAB onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders with text', () => {
    render(<QuickCreateFAB onClick={() => {}} />)
    expect(screen.getByText('Seleziona campo')).toBeInTheDocument()
  })

  it('renders Zap icon', () => {
    render(<QuickCreateFAB onClick={() => {}} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<QuickCreateFAB onClick={() => {}} className="custom-fab" />)
    const container = screen.getByRole('button').parentElement
    expect(container).toHaveClass('custom-fab')
  })

  it('button has correct size class', () => {
    render(<QuickCreateFAB onClick={() => {}} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('w-full')
    expect(button).toHaveClass('text-sm')
  })
})