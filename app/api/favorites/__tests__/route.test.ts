import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from '../route'

const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockFavorites = ['court-1', 'court-2']

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { favorite_court_ids: mockFavorites },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return { select: vi.fn() }
    }),
  })),
}))

describe('API /favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns favorites for authenticated user', async () => {
      const response = await GET()
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.favorite_court_ids).toEqual(mockFavorites)
    })

    it('returns empty array when profile not found', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockImplementation(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        })),
      }))

      const response = await GET()
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.favorite_court_ids).toEqual([])
    })

    it('returns 401 when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockImplementation(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') }),
        },
        from: vi.fn(),
      }))

      const response = await GET()
      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Unauthorized')
    })
  })

  describe('PATCH', () => {
    it('adds a court to favorites', async () => {
      const request = new Request('http://localhost/api/favorites', {
        method: 'PATCH',
        body: JSON.stringify({ court_id: 'court-3', action: 'add' }),
      })

      const response = await PATCH(request as any)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.favorite_court_ids).toContain('court-3')
    })

    it('removes a court from favorites', async () => {
      const request = new Request('http://localhost/api/favorites', {
        method: 'PATCH',
        body: JSON.stringify({ court_id: 'court-1', action: 'remove' }),
      })

      const response = await PATCH(request as any)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.favorite_court_ids).not.toContain('court-1')
    })

    it('returns 400 when missing required fields', async () => {
      const request = new Request('http://localhost/api/favorites', {
        method: 'PATCH',
        body: JSON.stringify({ court_id: 'court-1' }),
      })

      const response = await PATCH(request as any)
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toMatch(/required/i)
    })

    it('returns 401 when user is not authenticated', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockImplementation(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') }),
        },
        from: vi.fn(),
      }))

      const request = new Request('http://localhost/api/favorites', {
        method: 'PATCH',
        body: JSON.stringify({ court_id: 'court-1', action: 'add' }),
      })

      const response = await PATCH(request as any)
      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Unauthorized')
    })
  })
})
