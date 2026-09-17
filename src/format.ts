import { zonedParts } from './timezone.js'
import { regionForTimeZone } from './timezone-regions.js'

/** Locale-aware formatting for the values on screen. */

/**
 * Intl formatters are costly to build and cheap to use, and a screen only ever
 * needs a handful of them. Each is built once per distinct set of options.
 */
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()
const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>()

function dateTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let formatter = dateTimeFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    dateTimeFormatters.set(key, formatter)
  }
  return formatter
}

function relativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeTimeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeTimeFormatters.set(locale, formatter)
  }
  return formatter
}

function clockOptions(
  timeZone: string,
  hour12: boolean,
): Intl.DateTimeFormatOptions {
  return {
    timeZone,
    hour12,
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
  }
}

/** World English: day before month, which is the majority convention. */
const FALLBACK_LOCALE = 'en-001'

/**
 * The interface is English everywhere. Only the conventions follow the screen:
 * the region behind its timezone decides whether a date reads "16 September" or
 * "September 16", and where the commas and full stops go.
 */
export function displayLocale(timeZone: string): string {
  const region = regionForTimeZone(timeZone)
  return region ? `en-${region}` : FALLBACK_LOCALE
}

/** "04:43" on a 24 hour clock, "4:43 AM" on a 12 hour one. */
export function formatClock(
  date: Date,
  locale: string,
  timeZone: string,
  hour12: boolean,
): string {
  return dateTimeFormatter(locale, clockOptions(timeZone, hour12)).format(date)
}

/** "Tuesday 15 September", or "Tuesday, September 15", per the screen's region. */
export function formatLongDate(
  date: Date,
  locale: string,
  timeZone: string,
): string {
  return dateTimeFormatter(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** "21 Sept", or "Sept 21", per the screen's region. */
export function formatShortDate(
  date: Date,
  locale: string,
  timeZone: string,
): string {
  return dateTimeFormatter(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/**
 * "6:41 - 7:16 PM": Intl drops the repeated day period on its own. A range
 * that crosses local midnight is written as two clocks, since Intl would add
 * the dates to it.
 */
export function formatClockRange(
  start: Date,
  end: Date,
  locale: string,
  timeZone: string,
  hour12: boolean,
): string {
  const formatter = dateTimeFormatter(locale, clockOptions(timeZone, hour12))
  const sameDay =
    zonedParts(start, timeZone).day === zonedParts(end, timeZone).day
  return sameDay
    ? formatter.formatRange(start, end)
    : `${formatter.format(start)} – ${formatter.format(end)}`
}

/** "16h 38m", or "38m" when there is no whole hour. */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`
}

/** "+2m 11s" or "-3m 04s", for the change in day length. */
export function formatSignedDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+'
  const total = Math.abs(Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  const padded = String(remainder).padStart(2, '0')
  return minutes > 0 ? `${sign}${minutes}m ${padded}s` : `${sign}${remainder}s`
}

/** "in 6 days", "tomorrow", "in 4 hours". */
export function formatCountdown(
  target: Date,
  now: Date,
  locale: string,
): string {
  const relative = relativeTimeFormatter(locale)
  const minutes = Math.round((target.getTime() - now.getTime()) / 60000)

  if (Math.abs(minutes) < 60) {
    return relative.format(minutes, 'minute')
  }
  if (Math.abs(minutes) < 36 * 60) {
    return relative.format(Math.round(minutes / 60), 'hour')
  }
  return relative.format(Math.round(minutes / 1440), 'day')
}

/**
 * "25.2048° N, 55.2708° E". Same shape as the library's helper, kept local so
 * the render path can be tested outside a browser.
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latitudeText = `${Math.abs(latitude).toFixed(4)}° ${
    latitude < 0 ? 'S' : 'N'
  }`
  const longitudeText = `${Math.abs(longitude).toFixed(4)}° ${
    longitude < 0 ? 'W' : 'E'
  }`
  return `${latitudeText}, ${longitudeText}`
}

/** Degrees with a degree sign, rounded to whole degrees. */
export function formatDegrees(value: number): string {
  return `${Math.round(value)}°`
}

/** Compass point for an azimuth in degrees. */
const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

export function formatCompass(azimuth: number): string {
  const index = Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16
  return COMPASS[index]!
}
