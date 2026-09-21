/**
 * Timezone helpers built on Intl, so no date library is needed on the player.
 */

import type { CalendarDate } from './astro/index.js'
import { MS_PER_DAY, MS_PER_MINUTE } from './astro/index.js'

export interface ZonedParts extends CalendarDate {
  hour: number
  minute: number
  second: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

/** Break an instant into the wall-clock fields shown in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return {
    year: field('year'),
    month: field('month'),
    day: field('day'),
    hour: field('hour'),
    minute: field('minute'),
    second: field('second'),
  }
}

/** Offset from UTC in minutes at the given instant, east of Greenwich positive. */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone)
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / MS_PER_MINUTE
}

/**
 * The instant of a given wall-clock time in `timeZone`.
 *
 * A wall-clock time skipped by a forward clock change (00:00 in a zone that
 * springs forward at midnight) has no instant of its own; the first instant
 * after the gap is returned, so a day start never drifts into the day before.
 */
export function instantFromZoned(
  date: CalendarDate,
  hour: number,
  timeZone: string,
  minute = 0,
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute)
  const firstGuess = new Date(
    naive - zoneOffsetMinutes(new Date(naive), timeZone) * MS_PER_MINUTE,
  )
  // A second pass settles the case where the first guess lands on the other
  // side of a daylight saving transition.
  const secondGuess = new Date(
    naive - zoneOffsetMinutes(firstGuess, timeZone) * MS_PER_MINUTE,
  )
  // Compare wall-clock minutes; `naive` has already carried an hour of 24 or
  // an overflowing minute into the next day.
  const wanted = new Date(naive)
  const settled = zonedParts(secondGuess, timeZone)
  if (
    settled.hour * 60 + settled.minute ===
    wanted.getUTCHours() * 60 + wanted.getUTCMinutes()
  ) {
    return secondGuess
  }

  // Neither offset reproduces the requested time, so the clocks jumped over
  // it. The later candidate is the transition instant itself.
  return new Date(Math.max(firstGuess.getTime(), secondGuess.getTime()))
}

/**
 * The UTC calendar date containing solar noon on the observer's local day.
 * Sun events are computed against this date so they belong to the local day
 * even where the timezone is a long way from the local meridian.
 *
 * Solar noon, not clock noon: the two can fall on different UTC dates where a
 * zone runs well ahead of its longitude (Auckland on summer time), and
 * `sunEvents` looks for the solar noon inside the date it is given. The
 * local day's solar noon is the one nearest its clock noon; Kiritimati's
 * clock is a whole day ahead of its sun, so the nearest is not the same date.
 */
export function utcDateOfLocalNoon(
  date: Date,
  timeZone: string,
  longitude: number,
): CalendarDate {
  const clockNoon = instantFromZoned(zonedParts(date, timeZone), 12, timeZone)
  // Mean solar noon: 12:00 at Greenwich, four minutes earlier per degree east,
  // on the UTC date of clock noon and then shifted to the nearest occurrence.
  const sameDate =
    Date.UTC(
      clockNoon.getUTCFullYear(),
      clockNoon.getUTCMonth(),
      clockNoon.getUTCDate(),
      12,
    ) -
    longitude * 4 * MS_PER_MINUTE
  const solarNoon = new Date(
    sameDate +
      Math.round((clockNoon.getTime() - sameDate) / MS_PER_DAY) * MS_PER_DAY,
  )
  return {
    year: solarNoon.getUTCFullYear(),
    month: solarNoon.getUTCMonth() + 1,
    day: solarNoon.getUTCDate(),
  }
}

/** Midnight at the start of the local day containing `date`. */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  return instantFromZoned(zonedParts(date, timeZone), 0, timeZone)
}
