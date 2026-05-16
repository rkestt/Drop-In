import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreateLobbySheet } from '../create-lobby-sheet'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}))

describe('CreateLobbySheet', () => {
  it('renders with court name', () => {
    render(
      <CreateLobbySheet
        open={true}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.getByText('Basket Arena')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(
      <CreateLobbySheet
        open={true}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.getByRole('heading', { name: /crea lobby/i })).toBeInTheDocument()
  })

  it('renders players input', () => {
    render(
      <CreateLobbySheet
        open={true}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.getByLabelText(/numero massimo giocatori/i)).toBeInTheDocument()
  })

  it('renders time input', () => {
    render(
      <CreateLobbySheet
        open={true}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.getByLabelText(/orario inizio/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <CreateLobbySheet
        open={false}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('has drag handle to close', () => {
    render(
      <CreateLobbySheet
        open={true}
        onClose={() => {}}
        courtId="court-1"
        courtName="Basket Arena"
      />
    )
    expect(screen.getByRole('button', { name: /trascina verso il basso/i })).toBeInTheDocument()
  })
})