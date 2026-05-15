import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedAuth,
  setCachedAuth,
  clearAuthCache,
  isAuthCacheStale,
  CACHE_KEY_AUTH,
  CACHE_TTL_AUTH,
} from '../../cache/auth'
import * as storage from '../../cache/storage'

describe('auth cache', () => {
  beforeEach(() => {
    if (typeof localStorage.clear === 'function') {
      localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  describe('getCachedAuth', () => {
    it('returns null when no cache', () => {
      expect(getCachedAuth()).toBeNull()
    })

    it('returns null when cache is expired', () => {
      const expiredTimestamp = Date.now() - CACHE_TTL_AUTH - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user: { id: '1' }, timestamp: expiredTimestamp, version: 1 })
      )
      expect(getCachedAuth()).toBeNull()
    })

    it('returns null when version mismatch', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user: { id: '1' }, timestamp: Date.now(), version: 999 })
      )
      expect(getCachedAuth()).toBeNull()
    })

    it('returns null when timestamp is not a number', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user: { id: '1' }, timestamp: 'invalid', version: 1 })
      )
      expect(getCachedAuth()).toBeNull()
    })

    it('returns auth cache when valid', () => {
      const user = { id: 'user-123', email: 'test@test.com' }
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user, timestamp: Date.now(), version: 1 })
      )
      const result = getCachedAuth()
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(user)
    })

    it('clears cache on parse error', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue('invalid json')
      expect(getCachedAuth()).toBeNull()
    })
  })

  describe('setCachedAuth', () => {
    it('stores user in cache', () => {
      const user = { id: 'user-123', email: 'test@test.com' }
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      expect(setCachedAuth(user)).toBe(true)
      expect(setItemSpy).toHaveBeenCalled()
      setItemSpy.mockRestore()
    })

    it('stores null user in cache', () => {
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      expect(setCachedAuth(null)).toBe(true)
      expect(setItemSpy).toHaveBeenCalled()
      setItemSpy.mockRestore()
    })
  })

  describe('clearAuthCache', () => {
    it('removes auth cache key', () => {
      localStorage.setItem(CACHE_KEY_AUTH, 'test')
      clearAuthCache()
      expect(localStorage.getItem(CACHE_KEY_AUTH)).toBeNull()
    })
  })

  describe('isAuthCacheStale', () => {
    it('returns true when no cache', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(null)
      expect(isAuthCacheStale()).toBe(true)
    })

    it('returns true when cache is expired', () => {
      const expiredTimestamp = Date.now() - CACHE_TTL_AUTH - 1
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user: { id: '1' }, timestamp: expiredTimestamp, version: 1 })
      )
      expect(isAuthCacheStale()).toBe(true)
    })

    it('returns false when cache is fresh', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify({ user: { id: '1' }, timestamp: Date.now(), version: 1 })
      )
      expect(isAuthCacheStale()).toBe(false)
    })
  })
})