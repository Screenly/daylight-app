/**
 * Equinoxes and solstices, found by solving for the moments the sun's apparent
 * longitude crosses 0, 90, 180 and 270 degrees.
 */

import {
  bisect,
  julianCentury,
  MS_PER_DAY,
  normalizeDegrees,
  toJulianDay,
} from './core.js'
import { sunApparentLongitude } from './sun.js'

export type SeasonEventName =
  'March equinox' | 'June solstice' | 'September equinox' | 'December solstice'

export interface SeasonEvent {
  name: SeasonEventName
  longitude: number
  date: Date
}

const SEASON_EVENTS: { name: SeasonEventName; longitude: number }[] = [
  { name: 'March equinox', longitude: 0 },
  { name: 'June solstice', longitude: 90 },
  { name: 'September equinox', longitude: 180 },
  { name: 'December solstice', longitude: 270 },
]

function longitudeOffset(target: number) {
  return (date: Date): number => {
    const longitude = sunApparentLongitude(julianCentury(toJulianDay(date)))
    return normalizeDegrees(longitude - target + 180) - 180
  }
}

/** The next equinox or solstice at or after `from`. */
export function nextSeasonEvent(from: Date): SeasonEvent {
  const candidates = SEASON_EVENTS.map(({ name, longitude }) => {
    const offset = longitudeOffset(longitude)
    let previous = from
    let previousOffset = offset(previous)

    for (let day = 1; day <= 370; day += 1) {
      const current = new Date(from.getTime() + day * MS_PER_DAY)
      const currentOffset = offset(current)
      if (previousOffset < 0 && currentOffset >= 0) {
        return { name, longitude, date: bisect(offset, previous, current) }
      }
      previous = current
      previousOffset = currentOffset
    }

    return null
  }).filter((event): event is SeasonEvent => event !== null)

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates[0]!
}
