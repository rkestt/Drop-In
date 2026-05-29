import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LobbyCard } from '../lobby-card'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { banned_until: null, karma_score: 90 },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        then: vi.fn((cb) => cb({ error: null })),
      }),
    }),
  })),
}))

const mockLobby = {
  id: 'lobby-1',
  court_id: 'court-1',
  creator_id: 'user-1',
  start_time: '2024-06-01T18:00:00Z',
  max_players: 4,
  status: 'open',
  courts: { name: 'Basket Arena' },
  participants_count: 2,
  participants: [
    { user_id: 'user-1', nickname: 'Player1' },
    { user_id: 'user-2', nickname: 'Player2' },
  ],
}

describe('LobbyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.location
    window.location = { reload: vi.fn() } as any
  })

  it('renders lobby with court name', () => {
    render(<LobbyCard lobby={mockLobby} />)
    expect(screen.getByText('Basket Arena')).toBeInTheDocument()
  })

  it('renders participants count', () => {
    render(<LobbyCard lobby={mockLobby} />)
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })

  it('shows open status badge', () => {
    render(<LobbyCard lobby={mockLobby} />)
    expect(screen.getByText('Aperta')).toBeInTheDocument()
  })

  it('shows in_progress status badge', () => {
    const lobbyInProgress = { ...mockLobby, status: 'in_progress' }
    render(<LobbyCard lobby={lobbyInProgress} />)
    expect(screen.getByText('In corso')).toBeInTheDocument()
  })

  it('shows join button when status is open', () => {
    render(<LobbyCard lobby={mockLobby} />)
    expect(screen.getByText('Unisciti')).toBeInTheDocument()
  })

  it('hides join button when status is not open', () => {
    const closedLobby = { ...mockLobby, status: 'closed' }
    render(<LobbyCard lobby={closedLobby} />)
    expect(screen.queryByText('Unisciti')).not.toBeInTheDocument()
  })

  it('shows full button when lobby is full', () => {
    const fullLobby = { ...mockLobby, participants_count: 4 }
    render(<LobbyCard lobby={fullLobby} />)
    expect(screen.getByText('Al completo')).toBeInTheDocument()
  })

  it('shows error when user not logged in', async () => {
    render(<LobbyCard lobby={mockLobby} userId={undefined} />)

    fireEvent.click(screen.getByText('Unisciti'))

    await waitFor(() => {
      expect(screen.getByText(/devi effettuare l'accesso/i)).toBeInTheDocument()
    })
  })

  it('renders participant nicknames', () => {
    render(<LobbyCard lobby={mockLobby} />)
    expect(screen.getByText('Player1')).toBeInTheDocument()
    expect(screen.getByText('Player2')).toBeInTheDocument()
  })

  it('links participant nicknames to public profile', () => {
    render(<LobbyCard lobby={mockLobby} />)
    const player1Link = screen.getByText('Player1').closest('a')
    const player2Link = screen.getByText('Player2').closest('a')
    expect(player1Link).toHaveAttribute('href', '/users/user-1')
    expect(player2Link).toHaveAttribute('href', '/users/user-2')
  })

  it('shows more participants indicator when > 4', () => {
    const lobbyMany = {
      ...mockLobby,
      participants: Array(6).fill(null).map((_, i) => ({ user_id: `user-${i}`, nickname: `Player${i}` })),
    }
    render(<LobbyCard lobby={lobbyMany} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows unknown court name when court is null', () => {
    const lobbyNoCourt = { ...mockLobby, courts: null }
    render(<LobbyCard lobby={lobbyNoCourt} />)
    expect(screen.getByText('Campo sconosciuto')).toBeInTheDocument()
  })
})