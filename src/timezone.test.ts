import { describe, expect, test } from 'bun:test'
import {
  instantFromZoned,
  startOfLocalDay,
  utcDateOfLocalNoon,
  zonedParts,
  zoneOffsetMinutes,
} from './timezone.js'

describe('timezone helpers', () => {
  test('reads wall clock fields in the target zone', () => {
    const parts = zonedParts(new Date('2024-06-21T12:00:00Z'), 'Asia/Tokyo')
    expect(parts).toMatchObject({
      year: 2024,
      month: 6,
      day: 21,
      hour: 21,
      minute: 0,
    })
  })

  test('reports offsets on both sides of Greenwich', () => {
    const summer = new Date('2024-07-01T12:00:00Z')
    expect(zoneOffsetMinutes(summer, 'Europe/London')).toBe(60)
    expect(zoneOffsetMinutes(summer, 'America/New_York')).toBe(-240)
    expect(zoneOffsetMinutes(summer, 'UTC')).toBe(0)
  })

  test('follows daylight saving transitions', () => {
    expect(
      zoneOffsetMinutes(new Date('2024-01-15T12:00:00Z'), 'Europe/London'),
    ).toBe(0)
    expect(
      zoneOffsetMinutes(new Date('2024-07-15T12:00:00Z'), 'Europe/London'),
    ).toBe(60)
  })

  test('resolves a wall clock hour back to an instant', () => {
    const instant = instantFromZoned(
      { year: 2024, month: 7, day: 4 },
      9,
      'America/New_York',
    )
    expect(instant.toISOString()).toBe('2024-07-04T13:00:00.000Z')
  })

  test('local midnight lands at the start of the local day', () => {
    const midnight = startOfLocalDay(
      new Date('2024-07-04T13:00:00Z'),
      'America/New_York',
    )
    expect(zonedParts(midnight, 'America/New_York')).toMatchObject({
      day: 4,
      hour: 0,
      minute: 0,
    })
  })

  test('local noon can fall on the previous UTC day', () => {
    // Kiritimati runs 14 hours ahead, Honolulu 10 behind, so local noon lands
    // on a different UTC day in each direction.
    expect(
      utcDateOfLocalNoon(
        new Date('2024-07-04T20:00:00Z'),
        'Pacific/Kiritimati',
        -157.4,
      ),
    ).toEqual({ year: 2024, month: 7, day: 4 })
    expect(
      utcDateOfLocalNoon(
        new Date('2024-07-04T20:00:00Z'),
        'Pacific/Honolulu',
        -157.9,
      ),
    ).toEqual({ year: 2024, month: 7, day: 4 })
  })
})

describe('local days', () => {
  test('the date follows solar noon where the zone runs ahead of the sun', () => {
    // 08:00 on 15 January in Auckland (UTC+13): clock noon is 23:00Z on the
    // 14th, but the sun is highest at about 00:30Z on the 15th.
    expect(
      utcDateOfLocalNoon(
        new Date('2025-01-14T19:00:00Z'),
        'Pacific/Auckland',
        174.76,
      ),
    ).toEqual({ year: 2025, month: 1, day: 15 })
  })

  test('a skipped midnight starts the day at the clock change', () => {
    // Chile springs forward at 00:00, so 6 September 2026 begins at 01:00.
    const start = startOfLocalDay(
      new Date('2026-09-06T15:00:00Z'),
      'America/Santiago',
    )
    expect(start.toISOString()).toBe('2026-09-06T04:00:00.000Z')
    expect(zonedParts(start, 'America/Santiago')).toMatchObject({
      day: 6,
      hour: 1,
      minute: 0,
    })
  })

  test('an ambiguous hour still resolves to the requested wall clock', () => {
    // 01:30 happens twice on 25 October 2026 in London.
    const instant = instantFromZoned(
      { year: 2026, month: 10, day: 25 },
      1,
      'Europe/London',
      30,
    )
    expect(zonedParts(instant, 'Europe/London')).toMatchObject({
      hour: 1,
      minute: 30,
    })
  })
})
