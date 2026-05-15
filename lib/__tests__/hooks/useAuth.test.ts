import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../../hooks/useAuth'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/lib/cache/auth', () => ({
  getCachedAuth: vi.fn(),
  setCachedAuth: vi.fn(),
  clearAuthCache: vi.fn(),
}))

import * as authCache from '../../cache/auth'

const mockUser: User = {
  id: 'user-123',
  email: 'test@test.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01',
} as User

let mockSupabase: any
let mockAuth: any

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    }
    mockSupabase = { auth: mockAuth }
  })

  it('initializes with loading true and user null', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue(null)
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('sets user from cache initially', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue({
      user: mockUser,
      timestamp: Date.now(),
      version: 1,
    })
    mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).not.toBeNull()
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('fetches fresh user and updates cache on success', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue(null)
    mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).not.toBeNull()
    expect(result.current.isStale).toBe(false)
    expect(authCache.setCachedAuth).toHaveBeenCalledWith(mockUser)
  })

  it('uses cached user on fetch error', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue({
      user: mockUser,
      timestamp: Date.now(),
      version: 1,
    })
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Network error') })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).not.toBeNull()
    expect(result.current.isStale).toBe(true)
  })

  it('sets user null when fetch fails and no cache', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue(null)
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Network error') })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('calls refreshAuth and sets loading', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue(null)
    mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockAuth.getUser.mockClear()
    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(mockAuth.getUser).toHaveBeenCalled()
  })

  it('calls logout and clears cache', async () => {
    vi.mocked(authCache.getCachedAuth).mockReturnValue(null)
    mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockAuth.signOut).toHaveBeenCalled()
    expect(authCache.clearAuthCache).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})