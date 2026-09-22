import { describe, expect, test } from 'bun:test'
import {
  equationOfTime,
  sunDeclination,
  sunEvents,
  sunPosition,
} from './sun.js'
import { julianCentury, toJulianDay } from './core.js'

const LONDON = { latitude: 51.5074, longitude: -0.1278 }
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 }
const LONGYEARBYEN = { latitude: 78.2232, longitude: 15.6267 }

function minutesFromUTC(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

/** Published almanac times are rounded to the minute, so allow two either way. */
function expectMinutesNear(actual: Date, expected: number) {
  expect(Math.abs(minutesFromUTC(actual) - expected)).toBeLessThanOrEqual(2)
}

describe('sun position', () => {
  test('declination is near zero at the March equinox', () => {
    const century = julianCentury(toJulianDay(new Date('2024-03-20T03:06:00Z')))
    expect(Math.abs(sunDeclination(century))).toBeLessThan(0.02)
  })

  test('declination peaks near the obliquity at the June solstice', () => {
    const century = julianCentury(toJulianDay(new Date('2024-06-20T20:51:00Z')))
    expect(sunDeclination(century)).toBeCloseTo(23.44, 1)
  })

  test('equation of time matches the early November maximum', () => {
    const century = julianCentury(toJulianDay(new Date('2024-11-03T12:00:00Z')))
    expect(equationOfTime(century)).toBeCloseTo(16.45, 0)
  })

  test('sun is high over London at midsummer noon', () => {
    const { altitude } = sunPosition(
      new Date('2024-06-21T12:00:00Z'),
      LONDON.latitude,
      LONDON.longitude,
    )
    // 90 - latitude + declination, give or take the equation of time.
    expect(altitude).toBeCloseTo(61.9, 0)
  })

  test('sun is below the horizon at local midnight', () => {
    const { altitude } = sunPosition(
      new Date('2024-06-21T00:00:00Z'),
      LONDON.latitude,
      LONDON.longitude,
    )
    expect(altitude).toBeLessThan(0)
  })
})

describe('sun events', () => {
  test('London midsummer sunrise and sunset', () => {
    const events = sunEvents(
      { year: 2024, month: 6, day: 21 },
      LONDON.latitude,
      LONDON.longitude,
    )
    // Published times: 04:43 and 21:21 BST.
    expectMinutesNear(events.sunrise!, 3 * 60 + 43)
    expectMinutesNear(events.sunset!, 20 * 60 + 21)
    expect(events.dayLengthMinutes / 60).toBeCloseTo(16.63, 1)
  })

  test('New York new year sunrise and sunset', () => {
    const events = sunEvents(
      { year: 2024, month: 1, day: 1 },
      NEW_YORK.latitude,
      NEW_YORK.longitude,
    )
    // Published times: 07:20 and 16:39 EST.
    expectMinutesNear(events.sunrise!, 12 * 60 + 20)
    expectMinutesNear(events.sunset!, 21 * 60 + 39)
  })

  test('solar noon sits close to clock noon at the prime meridian', () => {
    const events = sunEvents({ year: 2024, month: 4, day: 15 }, 51.48, 0)
    expect(Math.abs(minutesFromUTC(events.solarNoon) - 12 * 60)).toBeLessThan(2)
  })

  test('twilight steps outward from sunset', () => {
    const events = sunEvents(
      { year: 2024, month: 9, day: 21 },
      LONDON.latitude,
      LONDON.longitude,
    )
    expect(events.sunset!.getTime()).toBeLessThan(events.civilDusk!.getTime())
    expect(events.civilDusk!.getTime()).toBeLessThan(
      events.nauticalDusk!.getTime(),
    )
    expect(events.nauticalDusk!.getTime()).toBeLessThan(
      events.astronomicalDusk!.getTime(),
    )
  })

  test('polar night in Svalbard in December', () => {
    const events = sunEvents(
      { year: 2024, month: 12, day: 21 },
      LONGYEARBYEN.latitude,
      LONGYEARBYEN.longitude,
    )
    expect(events.sunrise).toBeNull()
    expect(events.polar).toBe('polar-night')
    expect(events.dayLengthMinutes).toBe(0)
  })

  test('midnight sun in Svalbard in June', () => {
    const events = sunEvents(
      { year: 2024, month: 6, day: 21 },
      LONGYEARBYEN.latitude,
      LONGYEARBYEN.longitude,
    )
    expect(events.sunset).toBeNull()
    expect(events.polar).toBe('midnight-sun')
    expect(events.dayLengthMinutes).toBe(1440)
  })
})
