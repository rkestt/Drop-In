import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LobbyList } from '../lobby-list'

const mockLobbies = [
  {
    id: 'lobby-1',
    court_id: 'court-1',
    start_time: new Date(Date.now() + 3600000).toISOString(),
    max_players: 4,
    status: 'open',
    courts: { name: 'Basket Arena' },
  },
]

const mockCounts = [{ lobby_id: 'lobby-1', count: 2 }]

const mockParticipants = [
  { user_id: 'user-1', nickname: 'Player1' },
  { user_id: 'user-2', nickname: 'Player2' },
]

const mockJoined = [{ lobby_id: 'lobby-1' }]

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'current-user' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'lobbies') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockLobbies, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'lobby_participants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockJoined, error: null }),
          }),
        }
      }
      return { select: vi.fn() }
    }),
    rpc: vi.fn((fn: string, params: Record<string, unknown>) => {
      if (fn === 'get_lobby_counts') {
        return Promise.resolve({ data: mockCounts, error: null })
      }
      if (fn === 'get_lobby_participants') {
        return Promise.resolve({ data: mockParticipants, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    })),
    removeChannel: vi.fn(),
  })),
}))

describe('LobbyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders lobby list with court name', async () => {
    render(<LobbyList />)
    await waitFor(() => {
      expect(screen.getByText('Basket Arena')).toBeInTheDocument()
    })
  })

  it('renders participant count', async () => {
    render(<LobbyList />)
    await waitFor(() => {
      expect(screen.getByText('2/4')).toBeInTheDocument()
    })
  })

  it('renders participant nicknames as links to public profiles', async () => {
    render(<LobbyList />)
    await waitFor(() => {
      expect(screen.getByText('Player1')).toBeInTheDocument()
      expect(screen.getByText('Player2')).toBeInTheDocument()
    })

    const player1Link = screen.getByText('Player1').closest('a')
    const player2Link = screen.getByText('Player2').closest('a')
    expect(player1Link).toHaveAttribute('href', '/users/user-1')
    expect(player2Link).toHaveAttribute('href', '/users/user-2')
  })

  it('shows "Iscritto" badge when user is joined', async () => {
    render(<LobbyList />)
    await waitFor(() => {
      expect(screen.getByText('Iscritto')).toBeInTheDocument()
    })
  })

})
