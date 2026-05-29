import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFavorites } from '../../hooks/useFavorites'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

const mockCourts = [
  { id: 'court-1', name: 'Court One', lat: 1, lng: 1 },
  { id: 'court-2', name: 'Court Two', lat: 2, lng: 2 },
]

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn((...args) => {
    const mockFn = useAuth as any
    if (mockFn._mockUser) {
      return { user: mockFn._mockUser }
    }
    return { user: null }
  }),
}))

vi.mock('../../hooks/useCourtCache', () => ({
  useCourtCache: vi.fn(() => ({ courts: mockCourts })),
}))

import { useAuth } from '../../hooks/useAuth'
import { useCourtCache } from '../../hooks/useCourtCache'

const mockUser = { id: 'user-123', email: 'test@test.com' }
let fetchMock: any

describe('useFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
    ;(useAuth as any)._mockUser = null
  })

  it('returns empty favoriteIds when no user', () => {
    const { result } = renderHook(() => useFavorites())

    expect(result.current.favoriteIds).toEqual([])
    expect(result.current.favoriteCourts).toEqual([])
  })

  it('fetches favorites when user exists', async () => {
    ;(useAuth as any)._mockUser = mockUser
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ favorite_court_ids: ['court-1'] }),
    })

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/favorites', {
        credentials: 'include',
      })
    })

    await waitFor(() => {
      expect(result.current.favoriteIds).toEqual(['court-1'])
    })
  })

  it('toggleFavorite adds court to favorites', async () => {
    ;(useAuth as any)._mockUser = mockUser
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() => useFavorites())

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    expect(result.current.favoriteIds).toContain('court-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/favorites', expect.any(Object))
  })

  it('toggleFavorite removes court from favorites', async () => {
    ;(useAuth as any)._mockUser = mockUser

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() => useFavorites())

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    expect(result.current.favoriteIds).not.toContain('court-1')
  })

  it('toggleFavorite does nothing when no user', async () => {
    const { result } = renderHook(() => useFavorites())

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.skip('toggleFavorite rolls back on API failure', async () => {
    ;(useAuth as any)._mockUser = mockUser
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useFavorites())

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    expect(result.current.favoriteIds).toContain('court-1')

    await act(async () => {
      await result.current.toggleFavorite('court-1')
    })

    expect(result.current.favoriteIds).toContain('court-1')
  })

  it('favoriteCourts maps IDs to Court objects', async () => {
    ;(useAuth as any)._mockUser = mockUser
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ favorite_court_ids: ['court-1', 'court-2'] }),
    })

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(result.current.favoriteCourts.length).toBe(2)
    })

    expect(result.current.favoriteCourts[0].name).toBe('Court One')
    expect(result.current.favoriteCourts[1].name).toBe('Court Two')
  })

  it('isFavorite returns correct boolean', async () => {
    ;(useAuth as any)._mockUser = mockUser
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ favorite_court_ids: ['court-1'] }),
    })

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(result.current.isFavorite('court-1')).toBe(true)
      expect(result.current.isFavorite('court-2')).toBe(false)
    })
  })
})