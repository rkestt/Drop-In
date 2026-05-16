import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCourtCache } from '../../hooks/useCourtCache'

vi.mock('@/lib/cache/courts', () => ({
  getCachedCourts: vi.fn(),
  setCachedCourts: vi.fn(),
}))

vi.mock('@/lib/cache/types', () => ({
  USE_COURT_CACHE: true,
}))

describe('useCourtCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('returns initial state with loading true', () => {
    const { result } = renderHook(() => useCourtCache())
    expect(result.current.loading).toBe(true)
    expect(result.current.courts).toEqual([])
  })

  it('returns cached courts when available', async () => {
    const { getCachedCourts } = await import('@/lib/cache/courts')
    const mockCourts = [
      { id: '1', name: 'Court A', lat: 1, lng: 1 },
      { id: '2', name: 'Court B', lat: 2, lng: 2 },
    ]
    vi.mocked(getCachedCourts).mockReturnValue(mockCourts)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCourts }),
    })

    const { result } = renderHook(() => useCourtCache())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.courts).toEqual(mockCourts)
  })

  it('fetches fresh data from API and updates cache', async () => {
    const { getCachedCourts, setCachedCourts } = await import('@/lib/cache/courts')
    const freshCourts = [{ id: '2', name: 'Court B', lat: 2, lng: 2 }]
    vi.mocked(getCachedCourts).mockReturnValue(null)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: freshCourts }),
    })

    const { result } = renderHook(() => useCourtCache())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(setCachedCourts).toHaveBeenCalledWith(freshCourts)
  })

  it('handles API error gracefully', async () => {
    const { getCachedCourts } = await import('@/lib/cache/courts')
    vi.mocked(getCachedCourts).mockReturnValue(null)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useCourtCache())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.courts).toEqual([])
  })

  it('works without cache', async () => {
    const { getCachedCourts } = await import('@/lib/cache/courts')
    vi.mocked(getCachedCourts).mockReturnValue(null)
    const mockCourts = [{ id: '1', name: 'Court A', lat: 1, lng: 1 }]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockCourts }),
    })

    const { result } = renderHook(() => useCourtCache())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.courts).toEqual(mockCourts)
  })
})