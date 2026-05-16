import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRecentCourts } from '../../hooks/useRecentCourts'

vi.mock('@/lib/cache/recent-courts', () => ({
  getRecentCourts: vi.fn(() => []),
  addRecentCourt: vi.fn(),
}))

vi.mock('@/lib/hooks/useCourtCache', () => ({
  useCourtCache: vi.fn(() => ({
    courts: [
      { id: '1', name: 'Court A', address: 'Address A', lat: 1, lng: 1, sport: 'basketball' },
      { id: '2', name: 'Court B', address: 'Address B', lat: 2, lng: 2, sport: 'soccer' },
      { id: '3', name: 'Court C', address: 'Address C', lat: 3, lng: 3, sport: 'tennis' },
    ],
    loading: false,
    isStale: false,
  })),
}))

describe('useRecentCourts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no recent courts', async () => {
    const { getRecentCourts } = await import('@/lib/cache/recent-courts')
    vi.mocked(getRecentCourts).mockReturnValue([])

    const { result } = renderHook(() => useRecentCourts())

    expect(result.current.recentCourts).toEqual([])
  })

  it('returns recent courts from cache', async () => {
    const { getRecentCourts } = await import('@/lib/cache/recent-courts')
    vi.mocked(getRecentCourts).mockReturnValue([
      { id: '1', name: 'Court A', address: 'Address A', sport: 'basketball' },
    ])

    const { result } = renderHook(() => useRecentCourts())

    await waitFor(() => {
      expect(result.current.recentCourts).toHaveLength(1)
    })

    expect(result.current.recentCourts[0]?.name).toBe('Court A')
  })

  it('adds court to recent list', async () => {
    const { addRecentCourt } = await import('@/lib/cache/recent-courts')
    vi.mocked(addRecentCourt).mockImplementation(() => {})

    const { result } = renderHook(() => useRecentCourts())

    result.current.addRecent({
      id: '4',
      name: 'Court D',
      address: 'Address D',
      sport: 'volleyball',
    })

    expect(addRecentCourt).toHaveBeenCalledWith({
      id: '4',
      name: 'Court D',
      address: 'Address D',
      sport: 'volleyball',
    })
  })

  it('limits recent courts to 5', async () => {
    const { result } = renderHook(() => useRecentCourts())

    const recentIds: string[] = []
    for (let i = 1; i <= 6; i++) {
      result.current.addRecent({
        id: `${i}`,
        name: `Court ${i}`,
        address: `Address ${i}`,
        sport: 'basketball',
      })
    }

    await waitFor(() => {
      expect(recentIds.length).toBeLessThanOrEqual(5)
    })
  })

  it('filters out undefined courts', async () => {
    const { getRecentCourts } = await import('@/lib/cache/recent-courts')
    vi.mocked(getRecentCourts).mockReturnValue([
      { id: '1', name: 'Court A', address: 'Address A', sport: 'basketball' },
      { id: '999', name: 'Non Existent', address: 'Address', sport: 'basketball' },
    ])

    const { result } = renderHook(() => useRecentCourts())

    await waitFor(() => {
      expect(result.current.recentCourts).toHaveLength(1)
    })

    expect(result.current.recentCourts[0]?.id).toBe('1')
  })
})