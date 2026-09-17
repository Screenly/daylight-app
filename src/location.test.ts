import { describe, expect, test } from 'bun:test'
import { parseCityName } from './location.js'

describe('reading a screen location', () => {
  test('takes the city from what IP geolocation writes', () => {
    expect(parseCityName('Dubai, United Arab Emirates')).toBe('Dubai')
    expect(parseCityName('New York, NY, USA')).toBe('New York')
  })

  test('a bare name is used as it stands', () => {
    expect(parseCityName('Lobby')).toBe('Lobby')
  })

  test('a screen with no location yields nothing to show', () => {
    expect(parseCityName('')).toBeNull()
    expect(parseCityName('   ')).toBeNull()
    expect(parseCityName(undefined)).toBeNull()
    expect(parseCityName(', Germany')).toBeNull()
  })

  test('the dev server placeholder is not a location', () => {
    expect(parseCityName('Development Environment')).toBeNull()
  })

  test('a typed street address splits where the console splits it', () => {
    // Google's formatted_address is stored verbatim when a user picks a
    // suggestion, so the first segment can be a street rather than a city.
    expect(
      parseCityName('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA'),
    ).toBe('1600 Amphitheatre Pkwy')
  })

  test('tolerates stray whitespace', () => {
    expect(parseCityName('  Dubai ,  United Arab Emirates  ')).toBe('Dubai')
  })
})
