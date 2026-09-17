/**
 * Golden hour: the window where the sun sits low enough for warm light.
 *
 * Kept apart from the view model because the edge cases carry the weight. A
 * day whose sun never climbs past six degrees is golden from sunrise to sunset,
 * and under the midnight sun the window runs from the evening dip to the next
 * morning's climb.
 */

import type { SunEvents } from './astro/index.js'
import { zonedParts } from './timezone.js'

/** The golden hour window in progress, or the next one to come. */
export interface GoldenHour {
  start: Date
  end: Date
  /** Which window this is: morning, evening, all day, or overnight. */
  note: string
}

/**
 * Every golden hour window across the given days, in order. A day whose sun
 * never climbs past six degrees is golden from sunrise to sunset; under the
 * midnight sun the window runs from the evening dip to the next morning's
 * climb.
 */
export function goldenWindows(days: SunEvents[]): GoldenHour[] {
  const windows: GoldenHour[] = []
  days.forEach((day, index) => {
    const next = days[index + 1]

    if (day.sunrise && day.goldenHourEnd) {
      windows.push({
        start: day.sunrise,
        end: day.goldenHourEnd,
        note: 'morning',
      })
    }

    if (day.goldenHourStart) {
      if (day.sunset) {
        windows.push({
          start: day.goldenHourStart,
          end: day.sunset,
          note: 'evening',
        })
      } else if (next?.goldenHourEnd) {
        windows.push({
          start: day.goldenHourStart,
          end: next.goldenHourEnd,
          note: 'overnight',
        })
      }
    } else if (day.sunrise && day.sunset) {
      windows.push({ start: day.sunrise, end: day.sunset, note: 'all day' })
    }
  })
  return windows
}

/** True for an instant still to come that falls on a later local day. */
function isLaterLocalDay(instant: Date, now: Date, timeZone: string): boolean {
  if (instant.getTime() <= now.getTime()) {
    return false
  }

  const today = zonedParts(now, timeZone)
  const then = zonedParts(instant, timeZone)
  return (
    then.year !== today.year ||
    then.month !== today.month ||
    then.day !== today.day
  )
}

export function currentOrNextGoldenHour(
  now: Date,
  days: SunEvents[],
  timeZone: string,
): GoldenHour | null {
  const window =
    goldenWindows(days)
      .filter((candidate) => candidate.end.getTime() > now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null

  if (!window) {
    return null
  }

  // Late in the evening the next window is the following sunrise, and a bare
  // "morning" beside it reads as one that has already been and gone.
  return isLaterLocalDay(window.start, now, timeZone)
    ? { ...window, note: `tomorrow ${window.note}` }
    : window
}
