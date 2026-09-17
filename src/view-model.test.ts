import { describe, expect, test } from 'bun:test'
import {
  buildSkyModel,
  fractionOfDay,
  fractionOfLocalHour,
} from './view-model.js'

const LONDON = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZone: 'Europe/London',
}
const SYDNEY = {
  latitude: -33.8688,
  longitude: 151.2093,
  timeZone: 'Australia/Sydney',
}
const LONGYEARBYEN = {
  latitude: 78.2232,
  longitude: 15.6267,
  timeZone: 'Arctic/Longyearbyen',
}
const AUCKLAND = {
  latitude: -36.85,
  longitude: 174.76,
  timeZone: 'Pacific/Auckland',
}
const FAIRBANKS = {
  latitude: 64.84,
  longitude: -147.72,
  timeZone: 'America/Anchorage',
}
const REYKJAVIK = {
  latitude: 64.13,
  longitude: -21.9,
  timeZone: 'Atlantic/Reykjavik',
}

describe('sky model', () => {
  test('midsummer noon in London', () => {
    const model = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)

    expect(model.sun.altitude).toBeGreaterThan(60)
    expect(model.events.dayLengthMinutes / 60).toBeCloseTo(16.6, 1)
    expect(model.nextSunEvent?.label).toBe('Sunset')
    // Solar noon in London is a couple of minutes past 12:00 UTC in June.
    expect(model.rising).toBe(true)
    expect(buildSkyModel(new Date('2024-06-21T15:00:00Z'), LONDON).rising).toBe(
      false,
    )
  })

  test('the path is sampled across the whole local day', () => {
    const model = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)

    expect(model.path).toHaveLength(145)
    expect(model.path[0]!.fraction).toBe(0)
    expect(model.path[model.path.length - 1]!.fraction).toBe(1)
    // Local midnight either side of a midsummer day: sun well below the horizon.
    expect(model.path[0]!.altitude).toBeLessThan(-10)
    expect(
      Math.max(...model.path.map((point) => point.altitude)),
    ).toBeGreaterThan(60)
  })

  test('now sits where the clock says it does', () => {
    const model = buildSkyModel(new Date('2024-06-21T17:00:00Z'), LONDON)
    // 18:00 British Summer Time.
    expect(model.nowFraction).toBeCloseTo(18 / 24, 3)
  })

  test('sunrise and sunset land inside the day window', () => {
    const model = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)
    const sunrise = fractionOfDay(model, model.events.sunrise!)
    const sunset = fractionOfDay(model, model.events.sunset!)

    expect(sunrise).not.toBeNull()
    expect(sunset).not.toBeNull()
    expect(sunrise!).toBeLessThan(sunset!)
  })

  test('the day is 23 hours long when the clocks go forward', () => {
    const model = buildSkyModel(new Date('2024-03-31T12:00:00Z'), LONDON)
    expect(model.dayMs).toBe(23 * 3600000)
  })

  test('June in Sydney is the short end of the year', () => {
    const model = buildSkyModel(new Date('2024-06-21T02:00:00Z'), SYDNEY)
    expect(model.events.dayLengthMinutes / 60).toBeLessThan(10)
    expect(model.dayLengthDeltaSeconds).toBeGreaterThan(-30)
  })

  test('days lengthen after the December solstice', () => {
    const model = buildSkyModel(new Date('2024-12-28T12:00:00Z'), LONDON)
    expect(model.dayLengthDeltaSeconds).toBeGreaterThan(0)
  })

  test('polar night has no upcoming sunrise on the day itself', () => {
    const model = buildSkyModel(new Date('2024-12-21T12:00:00Z'), LONGYEARBYEN)
    expect(model.events.polar).toBe('polar-night')
    expect(model.events.sunrise).toBeNull()
    expect(model.sun.altitude).toBeLessThan(0)
  })

  test('moon and season are populated', () => {
    const now = new Date('2024-06-21T12:00:00Z')
    const model = buildSkyModel(now, LONDON)

    expect(model.moon.illumination.fraction).toBeGreaterThanOrEqual(0)
    expect(model.moon.illumination.fraction).toBeLessThanOrEqual(1)
    expect(model.moon.nextFull.getTime()).toBeGreaterThan(now.getTime())
    expect(model.moon.nextNew.getTime()).toBeGreaterThan(now.getTime())
    expect(model.season.name).toBe('September equinox')
  })

  test('the sky is bright at noon and dark at night', () => {
    const noon = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)
    const night = buildSkyModel(new Date('2024-12-21T23:00:00Z'), LONDON)
    expect(noon.sky.scrim).toBeGreaterThan(night.sky.scrim)
  })
})

describe('local day edges', () => {
  test('the events belong to the local day where the zone runs ahead of the sun', () => {
    // 08:00 on 15 January in Auckland, UTC+13 on summer time.
    const model = buildSkyModel(new Date('2025-01-14T19:00:00Z'), AUCKLAND)
    const local = (date: Date | null) =>
      date ? fractionOfDay(model, date) : null

    expect(model.localDate).toEqual({ year: 2025, month: 1, day: 15 })
    expect(local(model.events.solarNoon)).not.toBeNull()
    expect(local(model.events.sunrise)).not.toBeNull()
    expect(local(model.events.sunset)).not.toBeNull()
    expect(model.rising).toBe(true)
    expect(model.nextSunEvent?.label).toBe('Sunset')
  })

  test('a sunset after midnight is still the next event', () => {
    // Fairbanks at 00:20 on 21 June: yesterday's sun is still setting.
    const model = buildSkyModel(new Date('2026-06-21T08:20:00Z'), FAIRBANKS)
    expect(model.nextSunEvent?.label).toBe('Sunset')
    expect(model.rising).toBe(false)
    expect(fractionOfDay(model, model.nextSunEvent!.date)).not.toBeNull()
  })

  test('golden hour is the window in progress or the next to come', () => {
    // London, 18:00 BST in June: the morning is long gone, the evening ahead.
    const evening = buildSkyModel(new Date('2024-06-21T17:00:00Z'), LONDON)
    expect(evening.goldenHour?.note).toBe('evening')
    expect(evening.goldenHour!.start.getTime()).toBeGreaterThan(
      evening.now.getTime(),
    )

    // 10:00 BST: the morning window has finished, so the evening one shows.
    const morning = buildSkyModel(new Date('2024-06-21T09:00:00Z'), LONDON)
    expect(morning.goldenHour?.note).toBe('evening')

    // Reykjavik at the winter solstice never sees the sun above six degrees.
    const winter = buildSkyModel(new Date('2024-12-21T12:00:00Z'), REYKJAVIK)
    expect(winter.goldenHour?.note).toBe('all day')

    // Under the midnight sun the window runs from the evening dip to morning.
    const tromso = buildSkyModel(new Date('2024-06-21T12:00:00Z'), {
      latitude: 69.65,
      longitude: 18.96,
      timeZone: 'Europe/Oslo',
    })
    expect(tromso.goldenHour?.note).toBe('overnight')

    // Polar night has none.
    const dark = buildSkyModel(new Date('2024-12-21T12:00:00Z'), LONGYEARBYEN)
    expect(dark.goldenHour).toBeNull()
  })
})

describe('axis and caching', () => {
  test('hour ticks follow the clock on a 25 hour day', () => {
    const model = buildSkyModel(new Date('2026-10-25T12:00:00Z'), LONDON)
    expect(model.dayMs).toBe(25 * 3600000)
    expect(fractionOfLocalHour(model, 0)).toBe(0)
    expect(fractionOfLocalHour(model, 24)).toBe(1)
    // 12:00 GMT is thirteen hours into a day that began at 00:00 BST.
    expect(fractionOfLocalHour(model, 12)).toBeCloseTo(13 / 25, 6)
  })

  test('an hour the clocks skip has no tick', () => {
    // 01:00 to 02:00 does not exist on 29 March 2026 in London.
    const model = buildSkyModel(new Date('2026-03-29T12:00:00Z'), LONDON)
    expect(fractionOfLocalHour(model, 1)).toBeNull()
    expect(fractionOfLocalHour(model, 3)).toBeCloseTo(2 / 23, 6)
  })

  test('the day block is reused within a day and rebuilt across days', () => {
    const first = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)
    const later = buildSkyModel(new Date('2024-06-21T12:20:00Z'), LONDON)
    expect(later.path).toBe(first.path)
    expect(later.moon.nextFull).toBe(first.moon.nextFull)

    const tomorrow = buildSkyModel(new Date('2024-06-22T12:00:00Z'), LONDON)
    expect(tomorrow.path).not.toBe(first.path)

    // Time moving backwards (the dev panel) invalidates the awaited instants.
    const earlier = buildSkyModel(new Date('2024-05-01T12:00:00Z'), LONDON)
    expect(earlier.moon.nextFull.getTime()).toBeLessThan(
      first.moon.nextFull.getTime(),
    )
  })
})

describe('the golden hour note', () => {
  const BOSTON = {
    latitude: 42.3601,
    longitude: -71.0589,
    timeZone: 'America/New_York',
  }

  const noteAt = (iso: string) =>
    buildSkyModel(new Date(iso), BOSTON).goldenHour?.note

  test('names the window that is current or next today', () => {
    // 06:00, 10:00 and 18:00 local.
    expect(noteAt('2026-09-26T10:00:00Z')).toBe('morning')
    expect(noteAt('2026-09-26T14:00:00Z')).toBe('evening')
    expect(noteAt('2026-09-26T22:00:00Z')).toBe('evening')
  })

  test('says tomorrow once the next window is on the next local day', () => {
    // 22:00 local: the next golden hour is the following sunrise.
    expect(noteAt('2026-09-27T02:00:00Z')).toBe('tomorrow morning')
  })

  test('a window already in progress is never called tomorrow', () => {
    for (const iso of [
      '2026-09-26T10:00:00Z',
      '2026-09-26T14:00:00Z',
      '2026-09-26T22:00:00Z',
      '2026-09-27T02:00:00Z',
    ]) {
      const model = buildSkyModel(new Date(iso), BOSTON)
      const { goldenHour, now } = model
      if (goldenHour && goldenHour.start.getTime() <= now.getTime()) {
        expect(goldenHour.note).not.toContain('tomorrow')
      }
    }
  })
})
