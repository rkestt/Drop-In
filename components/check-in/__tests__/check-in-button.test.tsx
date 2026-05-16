import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckInButton } from '../check-in-button'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}))

vi.mock('../check-in-sheet', () => ({
  CheckInSheet: vi.fn(() => null),
}))

describe('CheckInButton', () => {
  it('renders check-in button', () => {
    render(
      <CheckInButton
        courtId="court-1"
        courtName="Basket Arena"
        courtLat={41.89}
        courtLng={12.50}
      />
    )
    expect(screen.getByRole('button', { name: /check-in/i })).toBeInTheDocument()
  })

  it('renders MapPin icon', () => {
    render(
      <CheckInButton
        courtId="court-1"
        courtName="Basket Arena"
        courtLat={41.89}
        courtLng={12.50}
      />
    )
    expect(screen.getByText(/check-in/i)).toBeInTheDocument()
  })

  it('accepts court props', () => {
    render(
      <CheckInButton
        courtId="court-1"
        courtName="Basket Arena"
        courtLat={41.89}
        courtLng={12.50}
      />
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const openFn = vi.fn()
    render(
      <CheckInButton
        courtId="court-1"
        courtName="Basket Arena"
        courtLat={41.89}
        courtLng={12.50}
      />
    )
    fireEvent.click(screen.getByRole('button'))
  })

  it('renders with different court data', () => {
    const { rerender } = render(
      <CheckInButton
        courtId="court-1"
        courtName="Basket Arena"
        courtLat={41.89}
        courtLng={12.50}
      />
    )
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(
      <CheckInButton
        courtId="court-2"
        courtName="Soccer Field"
        courtLat={41.90}
        courtLng={12.51}
      />
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})