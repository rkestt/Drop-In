import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRecentCourts,
  addRecentCourt,
  clearRecentCourts,
} from '../../cache/recent-courts'
import * as storage from '../../cache/storage'

describe('recent courts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('getRecentCourts', () => {
    it('returns empty array when no cache', () => {
      expect(getRecentCourts()).toEqual([])
    })

    it('returns parsed courts from cache', () => {
      const courts = [
        { id: '1', name: 'Court 1', address: 'Address 1', sport: 'basket' },
        { id: '2', name: 'Court 2', address: 'Address 2', sport: 'soccer' },
      ]
      vi.spyOn(storage, 'getItem').mockReturnValue(JSON.stringify(courts))
      expect(getRecentCourts()).toEqual(courts)
    })

    it('returns empty array on parse error', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue('invalid')
      expect(getRecentCourts()).toEqual([])
    })

    it('returns empty array when not an array', () => {
      vi.spyOn(storage, 'getItem').mockReturnValue(JSON.stringify({ foo: 'bar' }))
      expect(getRecentCourts()).toEqual([])
    })
  })

  describe('addRecentCourt', () => {
    it('adds court to empty list', () => {
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      addRecentCourt({ id: '1', name: 'Court 1', address: 'Addr', sport: 'basket' })
      expect(setItemSpy).toHaveBeenCalled()
      setItemSpy.mockRestore()
    })

    it('moves existing court to front (deduplication)', () => {
      const getItemSpy = vi.spyOn(storage, 'getItem').mockReturnValue(
        JSON.stringify([
          { id: '1', name: 'Old Court', address: 'Addr', sport: 'basket' },
          { id: '2', name: 'Court 2', address: 'Addr', sport: 'soccer' },
        ])
      )
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)

      addRecentCourt({ id: '1', name: 'Updated Court', address: 'NewAddr', sport: 'basket' })

      const callArg = setItemSpy.mock.calls[0][1]
      const parsed = JSON.parse(callArg)
      expect(parsed[0].id).toBe('1')
      expect(parsed[0].name).toBe('Updated Court')

      getItemSpy.mockRestore()
      setItemSpy.mockRestore()
    })

    it('limits to 5 recent courts (LRU eviction)', () => {
      const courts = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        name: `Court ${i}`,
        address: 'Addr',
        sport: 'basket',
      }))
      vi.spyOn(storage, 'getItem').mockReturnValue(JSON.stringify(courts))
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)

      addRecentCourt({ id: 'new', name: 'New Court', address: 'Addr', sport: 'basket' })

      const callArg = setItemSpy.mock.calls[0][1]
      const parsed = JSON.parse(callArg)
      expect(parsed.length).toBe(5)
      expect(parsed[0].id).toBe('new')
      expect(parsed[4].id).toBe('3')

      setItemSpy.mockRestore()
    })
  })

  describe('clearRecentCourts', () => {
    it('clears recent courts', () => {
      const setItemSpy = vi.spyOn(storage, 'setItem').mockReturnValue(true)
      clearRecentCourts()
      expect(setItemSpy).toHaveBeenCalledWith(
        'dropin_recent_courts',
        '[]'
      )
      setItemSpy.mockRestore()
    })
  })
})