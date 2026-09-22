/**
 * Assembles everything the screen shows for one instant and one position.
 * Pure functions of the clock, so the whole view can be rebuilt on a tick and
 * tested without a browser.
 *
 * Most of the model changes once a day (the sun path, the day's events) or
 * once a month (the next full moon). Those parts are remembered between calls
 * and only rebuilt when the local day rolls over or the awaited instant
 * passes, so a tick costs little more than the sun and moon positions.
 */

import {
  moonEvents,
  moonIllumination,
  moonPhaseName,
  moonPosition,
  MS_PER_DAY,
  nextMoonPhase,
  nextSeasonEvent,
  sunEvents,
  sunPosition,
  type CalendarDate,
  type MoonEvents,
  type MoonIllumination,
  type MoonPhaseName,
  type MoonPosition,
  type SeasonEvent,
  type SunEvents,
  type SunPosition,
} from './astro/index.js'
import { currentOrNextGoldenHour, type GoldenHour } from './golden-hour.js'
import { skyColors, type SkyColors } from './sky.js'
import {
  instantFromZoned,
  startOfLocalDay,
  utcDateOfLocalNoon,
  zonedParts,
} from './timezone.js'

export interface Observer {
  latitude: number
  longitude: number
  timeZone: string
}

/** One point on the day's sun path. */
export interface SunSample {
  /** Position through the local day, 0 at midnight and 1 at the next midnight. */
  fraction: number
  altitude: number
}

export interface UpcomingSunEvent {
  label: 'Sunrise' | 'Sunset'
  date: Date
}

export interface SkyModel {
  now: Date
  observer: Observer
  sun: SunPosition
  /** True while the sun is climbing, which selects the dawn palette. */
  rising: boolean
  /** Events of the local day containing `now`. */
  events: SunEvents
  /** The neighbouring days, for events that spill across local midnight. */
  yesterdayEvents: SunEvents
  tomorrowEvents: SunEvents
  /** Change in day length against yesterday, in seconds. */
  dayLengthDeltaSeconds: number
  nextSunEvent: UpcomingSunEvent | null
  goldenHour: GoldenHour | null
  path: SunSample[]
  /** Where `now` sits on the path, on the same 0-to-1 scale as the samples. */
  nowFraction: number
  /** The observer's calendar date. */
  localDate: CalendarDate
  /** Midnight starting the observer's local day. */
  dayStart: Date
  /** Length of that local day in milliseconds; 23 or 25 hours across a clock change. */
  dayMs: number
  moon: {
    position: MoonPosition
    illumination: MoonIllumination
    phase: MoonPhaseName
    events: MoonEvents
    nextFull: Date
    nextNew: Date
  }
  season: SeasonEvent
  sky: SkyColors
}

/** Samples per day for the sun path curve: one every ten minutes. */
const PATH_SAMPLES = 144

function shiftCalendarDate(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day) + days * MS_PER_DAY,
  )
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/**
 * Sunrises and sunsets from the surrounding days, soonest first. Yesterday is
 * included because at high latitudes a sunset can fall after local midnight,
 * and it is still the next thing to happen.
 */
function upcomingSunEvent(
  now: Date,
  days: SunEvents[],
): UpcomingSunEvent | null {
  const candidates = days
    .flatMap((day) => [
      { label: 'Sunrise' as const, date: day.sunrise },
      { label: 'Sunset' as const, date: day.sunset },
    ])
    .filter((event): event is UpcomingSunEvent => event.date !== null)
    .filter((event) => event.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return candidates[0] ?? null
}

/** Everything that is fixed for one local day at one position. */
interface DayBlock {
  key: string
  localDate: CalendarDate
  dayStart: Date
  dayEnd: Date
  dayMs: number
  events: SunEvents
  yesterday: SunEvents
  tomorrow: SunEvents
  path: SunSample[]
  moonEvents: MoonEvents
}

let dayCache: DayBlock | undefined

function dayBlock(now: Date, observer: Observer): DayBlock {
  const { latitude, longitude, timeZone } = observer
  const parts = zonedParts(now, timeZone)
  const localDate = { year: parts.year, month: parts.month, day: parts.day }
  const key = [
    timeZone,
    latitude,
    longitude,
    localDate.year,
    localDate.month,
    localDate.day,
  ].join('|')

  if (dayCache?.key === key) {
    return dayCache
  }

  const utcDate = utcDateOfLocalNoon(now, timeZone, longitude)
  const events = sunEvents(utcDate, latitude, longitude)
  const yesterday = sunEvents(
    shiftCalendarDate(utcDate, -1),
    latitude,
    longitude,
  )
  const tomorrow = sunEvents(shiftCalendarDate(utcDate, 1), latitude, longitude)

  const dayStart = startOfLocalDay(now, timeZone)
  const dayEnd = startOfLocalDay(
    new Date(dayStart.getTime() + MS_PER_DAY * 1.5),
    timeZone,
  )
  const dayMs = dayEnd.getTime() - dayStart.getTime()

  const path: SunSample[] = []
  for (let index = 0; index <= PATH_SAMPLES; index += 1) {
    const fraction = index / PATH_SAMPLES
    const sample = new Date(dayStart.getTime() + fraction * dayMs)
    path.push({
      fraction,
      altitude: sunPosition(sample, latitude, longitude).altitude,
    })
  }

  dayCache = {
    key,
    localDate,
    dayStart,
    dayEnd,
    dayMs,
    events,
    yesterday,
    tomorrow,
    path,
    moonEvents: moonEvents(dayStart, dayEnd, latitude, longitude),
  }
  return dayCache
}

/** The awaited instants, valid from `computedAt` until the first one passes. */
interface Upcoming {
  computedAt: Date
  nextFull: Date
  nextNew: Date
  season: SeasonEvent
}

let upcomingCache: Upcoming | undefined

function upcoming(now: Date): Upcoming {
  const cached = upcomingCache
  const time = now.getTime()
  if (
    cached &&
    time >= cached.computedAt.getTime() &&
    time < cached.nextFull.getTime() &&
    time < cached.nextNew.getTime() &&
    time < cached.season.date.getTime()
  ) {
    return cached
  }

  upcomingCache = {
    computedAt: now,
    nextFull: nextMoonPhase(now, 180),
    nextNew: nextMoonPhase(now, 0),
    season: nextSeasonEvent(now),
  }
  return upcomingCache
}

export function buildSkyModel(now: Date, observer: Observer): SkyModel {
  const { latitude, longitude } = observer
  const day = dayBlock(now, observer)
  const days = [day.yesterday, day.events, day.tomorrow]

  const sun = sunPosition(now, latitude, longitude)
  // Before the sun's own meridian passage, whichever calendar day that is.
  const rising = sun.hourAngle < 0

  const illumination = moonIllumination(now)
  const awaited = upcoming(now)

  return {
    now,
    observer,
    sun,
    rising,
    events: day.events,
    yesterdayEvents: day.yesterday,
    tomorrowEvents: day.tomorrow,
    dayLengthDeltaSeconds:
      (day.events.dayLengthMinutes - day.yesterday.dayLengthMinutes) * 60,
    nextSunEvent: upcomingSunEvent(now, days),
    goldenHour: currentOrNextGoldenHour(now, days, observer.timeZone),
    path: day.path,
    nowFraction: (now.getTime() - day.dayStart.getTime()) / day.dayMs,
    localDate: day.localDate,
    dayStart: day.dayStart,
    dayMs: day.dayMs,
    moon: {
      position: moonPosition(now, latitude, longitude),
      illumination,
      phase: moonPhaseName(illumination),
      events: day.moonEvents,
      nextFull: awaited.nextFull,
      nextNew: awaited.nextNew,
    },
    season: awaited.season,
    sky: skyColors(sun.altitude, rising),
  }
}

/** Where an instant sits on the day's 0-to-1 scale, or null if it falls outside. */
export function fractionOfDay(model: SkyModel, date: Date): number | null {
  const fraction = (date.getTime() - model.dayStart.getTime()) / model.dayMs
  return fraction >= 0 && fraction <= 1 ? fraction : null
}

/**
 * Where a wall-clock hour of the local day sits on the same scale, so axis
 * ticks line up with the curve on a 23 or 25 hour day. Null for an hour the
 * clocks skipped.
 */
export function fractionOfLocalHour(
  model: SkyModel,
  hour: number,
): number | null {
  if (hour <= 0) {
    return 0
  }
  if (hour >= 24) {
    return 1
  }
  const instant = instantFromZoned(
    model.localDate,
    hour,
    model.observer.timeZone,
  )
  if (zonedParts(instant, model.observer.timeZone).hour !== hour) {
    return null
  }
  return fractionOfDay(model, instant)
}
