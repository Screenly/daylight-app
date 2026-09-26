import { describe, expect, test } from 'bun:test'

import { setClockOverride, now, isClockOverridden } from './clock.js'
import { instantForMoment, playbackLabel } from './playback-moments.js'
import type { Place } from './place.js'

const LONDON: Place = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZone: 'Europe/London',
  locale: 'en-GB',
  hour12: false,
  name: 'London',
  unlocated: false,
}

describe('playback moments', () => {
  test('sunrise and sunset are real instants for London', () => {
    const sunrise = instantForMoment('sunrise', LONDON)
    const sunset = instantForMoment('sunset', LONDON)
    const noon = instantForMoment('noon', LONDON)

    expect(sunrise).toBeInstanceOf(Date)
    expect(sunset).toBeInstanceOf(Date)
    expect(noon).toBeInstanceOf(Date)
    expect(sunrise!.getTime()).toBeLessThan(noon!.getTime())
    expect(noon!.getTime()).toBeLessThan(sunset!.getTime())
  })

  test('full and new moon are in the future', () => {
    const before = Date.now()
    const full = instantForMoment('full_moon', LONDON)
    const neu = instantForMoment('new_moon', LONDON)

    expect(full!.getTime()).toBeGreaterThanOrEqual(before)
    expect(neu!.getTime()).toBeGreaterThanOrEqual(before)
  })

  test('season lands on the next equinox or solstice', () => {
    const season = instantForMoment('season', LONDON)
    expect(season).toBeInstanceOf(Date)
    expect(season!.getTime()).toBeGreaterThanOrEqual(Date.now() - 60_000)
  })
})

describe('clock override', () => {
  test('override freezes now()', () => {
    const frozen = new Date('2024-06-21T12:00:00Z')
    setClockOverride(frozen)
    expect(isClockOverridden()).toBe(true)
    expect(now().getTime()).toBe(frozen.getTime())
    setClockOverride(null)
    expect(isClockOverridden()).toBe(false)
  })
})

describe('playbackLabel', () => {
  test('live reads as Now', () => {
    expect(playbackLabel('live')).toBe('Now')
  })

  test('named modes get a short label', () => {
    expect(playbackLabel('sunrise')).toBe('Sunrise')
    expect(playbackLabel('noon')).toBe('Noon')
    expect(playbackLabel('new_moon')).toBe('New moon')
    expect(playbackLabel('auto_play')).toBe('Auto play')
    expect(playbackLabel('season')).toBe('Equinox / solstice')
  })
})
