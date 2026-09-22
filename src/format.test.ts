import { describe, expect, test } from 'bun:test'
import {
  displayLocale,
  formatClock,
  formatLongDate,
  formatCompass,
  formatCountdown,
  formatDegrees,
  formatDuration,
  formatSignedDuration,
} from './format.js'

describe('formatting', () => {
  test('durations', () => {
    expect(formatDuration(998)).toBe('16h 38m')
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(1440)).toBe('24h 0m')
  })

  test('signed durations', () => {
    expect(formatSignedDuration(131)).toBe('+2m 11s')
    expect(formatSignedDuration(-184)).toBe('-3m 04s')
    expect(formatSignedDuration(-12)).toBe('-12s')
  })

  test('countdowns pick a sensible unit', () => {
    const now = new Date('2024-06-21T12:00:00Z')
    expect(formatCountdown(new Date('2024-06-21T12:30:00Z'), now, 'en')).toBe(
      'in 30 minutes',
    )
    expect(formatCountdown(new Date('2024-06-22T00:00:00Z'), now, 'en')).toBe(
      'in 12 hours',
    )
    expect(formatCountdown(new Date('2024-06-27T12:00:00Z'), now, 'en')).toBe(
      'in 6 days',
    )
  })

  test('degrees and compass points', () => {
    expect(formatDegrees(33.6)).toBe('34°')
    expect(formatCompass(0)).toBe('N')
    expect(formatCompass(95)).toBe('E')
    expect(formatCompass(247)).toBe('WSW')
    expect(formatCompass(359)).toBe('N')
  })
})

describe('clock formatting', () => {
  const noon = new Date('2024-06-21T03:43:00Z')

  test('a 24 hour clock pads the hour', () => {
    expect(formatClock(noon, 'en-GB', 'Europe/London', false)).toBe('04:43')
    expect(formatClock(noon, 'en-DE', 'Europe/Berlin', false)).toBe('05:43')
  })

  test('a 12 hour clock keeps am and pm', () => {
    const text = formatClock(noon, 'en-US', 'America/New_York', true)
    expect(text).toContain('11:43')
    expect(text).toMatch(/PM|pm/)
  })

  test('the setting overrides what the region prefers', () => {
    // en-US prefers 12 hour, en-GB prefers 24; the screen decides.
    expect(formatClock(noon, 'en-US', 'Europe/London', false)).toBe('04:43')
    expect(formatClock(noon, 'en-GB', 'Europe/London', true)).toMatch(/4:43/)
  })
})

describe('display locale', () => {
  test('the timezone picks the region', () => {
    expect(displayLocale('Europe/Berlin')).toBe('en-DE')
    expect(displayLocale('America/New_York')).toBe('en-US')
    expect(displayLocale('Asia/Dubai')).toBe('en-AE')
    expect(displayLocale('Australia/Sydney')).toBe('en-AU')
  })

  test('an unknown zone falls back to world English', () => {
    for (const zone of ['', 'UTC', 'Mars/Olympus_Mons']) {
      expect(displayLocale(zone)).toBe('en-001')
    }
  })

  test('the result is always English', () => {
    for (const zone of ['Europe/Berlin', 'Asia/Tokyo', 'nonsense']) {
      expect(displayLocale(zone)).toMatch(/^en-/)
    }
  })

  test('the region sets the date order, in English either way', () => {
    const date = new Date('2026-09-16T12:00:00Z')
    const german = formatLongDate(date, displayLocale('Europe/Berlin'), 'UTC')
    const american = formatLongDate(
      date,
      displayLocale('America/Chicago'),
      'UTC',
    )

    // Assert the order rather than the exact string: the punctuation between
    // the parts moves with the ICU build, and it is the order that carries the
    // meaning.
    expect(german.indexOf('16')).toBeLessThan(german.indexOf('September'))
    expect(american.indexOf('September')).toBeLessThan(american.indexOf('16'))

    // English words on both, whatever the region.
    expect(german).toContain('Wednesday')
    expect(german).toContain('September')
    expect(american).toContain('Wednesday')
  })
})
