import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedProfile,
  setCachedProfile,
  clearProfileCache,
  isProfileCacheStale,
  CACHE_KEY_PROFILE,
  CACHE_TTL_PROFILE,
} from '../../cache/profile'
import * as storage from '../../cache/storage'

describe('profile cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const validProfile = {
    id: 'profile-1',
    user_id: 'user-123',
    nickname: 'TestUser',
    avatar_url: 'https://example.com/avatar.jpg',
    karma_score: 90,
    banned_until: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }

  describe('getCachedProfile', () => {
    it('returns null when no cache', () => {
      expect(getCachedProfile()).toBeNull()
    })

    it('returns null when cache is expired', () => {
      const expiredTimestamp = Date.now() - CACHE_TTL_PROFILE - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: expiredTimestamp, version: 1 })
      )
      expect(getCachedProfile()).toBeNull()
    })

    it('returns null when user_id is missing', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, user_id: '', timestamp: Date.now(), version: 1 })
      )
      expect(getCachedProfile()).toBeNull()
    })

    it('returns null when version mismatch', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: Date.now(), version: 999 })
      )
      expect(getCachedProfile()).toBeNull()
    })

    it('returns null when timestamp is not a number', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: 'invalid', version: 1 })
      )
      expect(getCachedProfile()).toBeNull()
    })

    it('returns profile when cache is valid', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: Date.now(), version: 1 })
      )
      const result = getCachedProfile()
      expect(result).not.toBeNull()
      expect(result?.user_id).toBe('user-123')
    })

    it('clears cache on parse error', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue('invalid json')
      expect(getCachedProfile()).toBeNull()
    })
  })

  describe('setCachedProfile', () => {
    it('stores profile in cache with timestamp and version', () => {
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      expect(setCachedProfile(validProfile)).toBe(true)
      expect(setItemSpy).toHaveBeenCalled()
      const callArg = setItemSpy.mock.calls[0][1]
      const parsed = JSON.parse(callArg)
      expect(parsed.user_id).toBe('user-123')
      expect(parsed.timestamp).toBeDefined()
      expect(parsed.version).toBe(1)
      setItemSpy.mockRestore()
    })
  })

  describe('clearProfileCache', () => {
    it('removes profile cache key', () => {
      localStorage.setItem(CACHE_KEY_PROFILE, 'test')
      clearProfileCache()
      expect(localStorage.getItem(CACHE_KEY_PROFILE)).toBeNull()
    })
  })

  describe('isProfileCacheStale', () => {
    it('returns true when no cache', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(null)
      expect(isProfileCacheStale()).toBe(true)
    })

    it('returns true when cache is expired', () => {
      const expiredTimestamp = Date.now() - CACHE_TTL_PROFILE - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: expiredTimestamp, version: 1 })
      )
      expect(isProfileCacheStale()).toBe(true)
    })

    it('returns false when cache is fresh', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ ...validProfile, timestamp: Date.now(), version: 1 })
      )
      expect(isProfileCacheStale()).toBe(false)
    })
  })
})