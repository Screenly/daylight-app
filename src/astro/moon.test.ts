import { describe, expect, test } from 'bun:test'
import {
  moonEvents,
  moonIllumination,
  moonPhaseName,
  moonPosition,
  nextMoonPhase,
  type MoonIllumination,
} from './moon.js'
import { MS_PER_DAY } from './core.js'

const LONDON = { latitude: 51.5074, longitude: -0.1278 }

function hoursApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 3600000
}

describe('moon phase', () => {
  test('full moon of 2024-01-25 is found within an hour', () => {
    const full = nextMoonPhase(new Date('2024-01-20T00:00:00Z'), 180)
    expect(hoursApart(full, new Date('2024-01-25T17:54:00Z'))).toBeLessThan(1)
  })

  test('new moon of 2024-02-09 is found within an hour', () => {
    const newMoon = nextMoonPhase(new Date('2024-02-05T00:00:00Z'), 0)
    expect(hoursApart(newMoon, new Date('2024-02-09T22:59:00Z'))).toBeLessThan(
      1,
    )
  })

  test('disc is fully lit at full moon and dark at new moon', () => {
    expect(
      moonIllumination(new Date('2024-01-25T17:54:00Z')).fraction,
    ).toBeGreaterThan(0.99)
    expect(
      moonIllumination(new Date('2024-02-09T22:59:00Z')).fraction,
    ).toBeLessThan(0.01)
  })

  test('half lit at first quarter, and waxing', () => {
    const illumination = moonIllumination(new Date('2024-02-16T15:01:00Z'))
    expect(illumination.fraction).toBeCloseTo(0.5, 1)
    expect(illumination.waxing).toBe(true)
  })

  test('waning after full moon', () => {
    expect(moonIllumination(new Date('2024-01-27T00:00:00Z')).waxing).toBe(
      false,
    )
  })

  test('phase names follow the lit fraction', () => {
    const name = (fraction: number, waxing: boolean) =>
      moonPhaseName({ fraction, waxing } as MoonIllumination)

    expect(name(0, true)).toBe('New moon')
    expect(name(0.01, true)).toBe('New moon')
    expect(name(1, false)).toBe('Full moon')
    expect(name(0.99, false)).toBe('Full moon')
    expect(name(0.5, true)).toBe('First quarter')
    expect(name(0.5, false)).toBe('Last quarter')
    expect(name(0.2, true)).toBe('Waxing crescent')
    expect(name(0.2, false)).toBe('Waning crescent')
    expect(name(0.8, true)).toBe('Waxing gibbous')
    expect(name(0.8, false)).toBe('Waning gibbous')
  })

  test('a crescent is never called a quarter', () => {
    // 5.6 days old, 31 percent lit: an equal-sector split calls this a first
    // quarter, which contradicts the disc on screen.
    const illumination = moonIllumination(new Date('2026-09-16T21:07:00Z'))
    expect(illumination.fraction).toBeLessThan(0.4)
    expect(moonPhaseName(illumination)).toBe('Waxing crescent')
  })
})

describe('moon position and events', () => {
  test('full moon is opposite the sun, so it is up at local midnight', () => {
    const { altitude } = moonPosition(
      new Date('2024-01-26T00:00:00Z'),
      LONDON.latitude,
      LONDON.longitude,
    )
    expect(altitude).toBeGreaterThan(30)
  })

  test('moonrise and moonset bracket a period above the horizon', () => {
    const start = new Date('2024-06-21T00:00:00Z')
    const events = moonEvents(
      start,
      new Date(start.getTime() + MS_PER_DAY),
      LONDON.latitude,
      LONDON.longitude,
    )
    expect(events.rise).not.toBeNull()
    expect(events.set).not.toBeNull()

    const midpoint = new Date(
      (events.rise!.getTime() + events.set!.getTime()) / 2,
    )
    const above = events.set!.getTime() > events.rise!.getTime()
    if (above) {
      expect(
        moonPosition(midpoint, LONDON.latitude, LONDON.longitude).altitude,
      ).toBeGreaterThan(0)
    }
  })

  test('altitude is close to zero at the reported moonrise', () => {
    const start = new Date('2024-03-10T00:00:00Z')
    const events = moonEvents(
      start,
      new Date(start.getTime() + MS_PER_DAY),
      LONDON.latitude,
      LONDON.longitude,
    )
    const altitude = moonPosition(
      events.rise!,
      LONDON.latitude,
      LONDON.longitude,
    ).altitude
    expect(Math.abs(altitude - 0.125)).toBeLessThan(0.01)
  })
})
