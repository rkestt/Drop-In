import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedCourts,
  setCachedCourts,
  isCacheStale,
  clearCourtCache,
} from '../../cache/courts'
import * as storage from '../../cache/storage'
import { CACHE_KEY_COURTS } from '../../cache/types'

describe('courts cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('getCachedCourts', () => {
    it('returns null when no cache exists', () => {
      expect(getCachedCourts()).toBeNull()
    })

    it('returns null when cache data is not an array', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ data: { foo: 'bar' }, timestamp: Date.now(), version: 1 })
      )
      expect(getCachedCourts()).toBeNull()
    })

    it('returns null when cache is stale (TTL expired)', () => {
      const staleTimestamp = Date.now() - 60 * 60 * 1000 - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ data: [], timestamp: staleTimestamp, version: 1 })
      )
      expect(getCachedCourts()).toBeNull()
    })

    it('returns null when version mismatch', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ data: [], timestamp: Date.now(), version: 999 })
      )
      expect(getCachedCourts()).toBeNull()
    })

    it('returns courts when cache is valid', () => {
      const courts = [{ id: '1', name: 'Court 1', lat: 1, lng: 1 }]
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ data: courts, timestamp: Date.now(), version: 1 })
      )
      expect(getCachedCourts()).toEqual(courts)
    })

    it('returns null on parse error', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue('invalid json')
      expect(getCachedCourts()).toBeNull()
    })
  })

  describe('setCachedCourts', () => {
    it('stores courts in cache', () => {
      const courts = [{ id: '1', name: 'Court 1', lat: 1, lng: 1 }]
      vi.spyOn(storage, 'setItem').mockReturnValue(true)
      expect(setCachedCourts(courts)).toBe(true)
    })
  })

  describe('isCacheStale', () => {
    it('returns true when no cache', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(null)
      expect(isCacheStale()).toBe(true)
    })

    it('returns true when cache is expired', () => {
      const staleTimestamp = Date.now() - 60 * 60 * 1000 - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ timestamp: staleTimestamp })
      )
      expect(isCacheStale()).toBe(true)
    })

    it('returns false when cache is fresh', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ timestamp: Date.now() })
      )
      expect(isCacheStale()).toBe(false)
    })
  })

  describe('clearCourtCache', () => {
    it('clears court cache', () => {
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      clearCourtCache()
      expect(setItemSpy).toHaveBeenCalledWith(CACHE_KEY_COURTS, '')
      setItemSpy.mockRestore()
    })
  })
})