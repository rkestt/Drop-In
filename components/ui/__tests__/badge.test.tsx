import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge', () => {
  it('renders badge with children', () => {
    render(<Badge>Badge Text</Badge>)
    expect(screen.getByText('Badge Text')).toBeInTheDocument()
  })

  it('renders with default variant by default', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('bg-[var(--bg-surface)]')
  })

  it('renders with accent variant', () => {
    render(<Badge variant="accent">Accent</Badge>)
    const badge = screen.getByText('Accent')
    expect(badge).toHaveClass('bg-[var(--accent-subtle)]')
  })

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success')
    expect(badge).toHaveClass('bg-[var(--success)]/20')
  })

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>)
    const badge = screen.getByText('Warning')
    expect(badge).toHaveClass('bg-[var(--warning)]/20')
  })

  it('renders with danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>)
    const badge = screen.getByText('Danger')
    expect(badge).toHaveClass('bg-[var(--danger)]/20')
  })

  it('forwards ref to span element', () => {
    const ref = { current: null }
    render(<Badge ref={ref}>Ref Badge</Badge>)
    expect(ref.current).not.toBeNull()
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-class')
  })

  it('renders as span element', () => {
    render(<Badge>Span</Badge>)
    const badge = screen.getByText('Span')
    expect(badge.tagName).toBe('SPAN')
  })
})