import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUserProfile } from '../../hooks/useUserProfile'

const mockProfile = {
  user_id: 'user-123',
  nickname: 'Test User',
  avatar_url: 'https://example.com/avatar.png',
  karma: 90,
  created_at: '2024-01-01',
  timestamp: Date.now(),
  version: 1 as const,
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    }),
  })),
  auth: { getUser: vi.fn() },
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/cache/profile', () => ({
  getCachedProfile: vi.fn(),
  setCachedProfile: vi.fn(),
  clearProfileCache: vi.fn(),
}))

describe('useUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null profile when userId is null', () => {
    const { result } = renderHook(() => useUserProfile(null))

    expect(result.current.profile).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('fetches profile on mount with valid userId', async () => {
    const { getCachedProfile, setCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(null)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.profile?.nickname).toBe('Test User')
    expect(setCachedProfile).toHaveBeenCalled()
  })

  it('returns cached profile when available', async () => {
    const { getCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(mockProfile)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.profile?.user_id).toBe('user-123')
    expect(result.current.profile?.nickname).toBe('Test User')
  })

  it('refreshes profile when refreshProfile is called', async () => {
    const { getCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(mockProfile)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    result.current.refreshProfile()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('updates profile when updateProfile is called', async () => {
    const { getCachedProfile, setCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(mockProfile)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const updateResult = await result.current.updateProfile({ nickname: 'New Name' })

    expect(updateResult).toBe(true)
    expect(setCachedProfile).toHaveBeenCalled()
  })

  it('returns false when updateProfile fails', async () => {
    const { getCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(mockProfile)

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
          }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const updateResult = await result.current.updateProfile({ nickname: 'New Name' })

    expect(updateResult).toBe(false)
  })

  it('clears profile when clearProfile is called', async () => {
    const { getCachedProfile, clearProfileCache } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(null)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    result.current.clearProfile()

    expect(clearProfileCache).toHaveBeenCalled()
  })

  it('handles fetch error and uses cache', async () => {
    const { getCachedProfile } = await import('@/lib/cache/profile')
    vi.mocked(getCachedProfile).mockReturnValue(mockProfile)

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
        }),
      }),
    } as any)

    const { result } = renderHook(() => useUserProfile('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.isStale).toBe(true)
  })
})