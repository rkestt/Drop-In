import { describe, it, expect } from 'vitest'
import { SPORTS } from '../sports'

describe('SPORTS', () => {
  it('contains all expected sports', () => {
    const expectedSports = [
      'basketball',
      'volleyball',
      'soccer',
      'tennis',
      'skate',
      'calisthenics',
      'football',
      'rugby',
      'handball',
      'badminton',
      'baseball',
      'hockey',
    ]
    expect(Object.keys(SPORTS)).toEqual(expectedSports)
  })

  it('each sport has label and color', () => {
    Object.entries(SPORTS).forEach(([key, value]) => {
      expect(value).toHaveProperty('label')
      expect(value).toHaveProperty('color')
      expect(typeof value.label).toBe('string')
      expect(value.label.length).toBeGreaterThan(0)
      expect(typeof value.color).toBe('string')
      expect(value.color.startsWith('#')).toBe(true)
    })
  })

  it('has correct Italian labels', () => {
    expect(SPORTS.basketball.label).toBe('Basket')
    expect(SPORTS.volleyball.label).toBe('Pallavolo')
    expect(SPORTS.soccer.label).toBe('Calcio')
    expect(SPORTS.tennis.label).toBe('Tennis')
    expect(SPORTS.skate.label).toBe('Skate')
    expect(SPORTS.calisthenics.label).toBe('Calisthenics')
  })

  it('has valid hex colors', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    Object.values(SPORTS).forEach((sport) => {
      expect(sport.color).toMatch(hexColorRegex)
    })
  })

  it('basketball has orange color', () => {
    expect(SPORTS.basketball.color).toBe('#f97316')
  })

  it('soccer has green color', () => {
    expect(SPORTS.soccer.color).toBe('#22c55e')
  })
})