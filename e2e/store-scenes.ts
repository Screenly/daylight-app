/**
 * Scenes for the store screenshots: five US cities, each frozen at a moment
 * that shows the app in a different state.
 *
 * The cities are drawn at random from a pool so the gallery is not always the
 * same five, and the instants are computed from the app's own astronomy, so
 * every shot lands on a real dawn or a real full moon rather than a clock time
 * that happens to look about right.
 */

import {
  moonIllumination,
  nextMoonPhase,
  sunEvents,
  type SunEvents,
} from '../src/astro/index.js'
import { instantFromZoned, utcDateOfLocalNoon, zonedParts } from '../src/timezone.js'

export interface City {
  name: string
  latitude: number
  longitude: number
}

/** Spread across latitudes and time zones, so the skies differ. */
export const US_CITIES: City[] = [
  { name: 'Anchorage, AK', latitude: 61.2181, longitude: -149.9003 },
  { name: 'Austin, TX', latitude: 30.2672, longitude: -97.7431 },
  { name: 'Boston, MA', latitude: 42.3601, longitude: -71.0589 },
  { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 },
  { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 },
  { name: 'Honolulu, HI', latitude: 21.3069, longitude: -157.8583 },
  { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 },
  { name: 'Miami, FL', latitude: 25.7617, longitude: -80.1918 },
  { name: 'Minneapolis, MN', latitude: 44.9778, longitude: -93.265 },
  { name: 'Nashville, TN', latitude: 36.1627, longitude: -86.7816 },
  { name: 'New York, NY', latitude: 40.7128, longitude: -74.006 },
  { name: 'Phoenix, AZ', latitude: 33.4484, longitude: -112.074 },
  { name: 'Portland, OR', latitude: 45.5152, longitude: -122.6784 },
  { name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194 },
  { name: 'Seattle, WA', latitude: 47.6062, longitude: -122.3321 },
]

/** The states worth showing, in the order they read best in a gallery. */
export const SCENE_NAMES = [
  'dawn',
  'midday',
  'golden-hour',
  'dusk',
  'full-moon',
] as const

export type SceneName = (typeof SCENE_NAMES)[number]

export interface Scene {
  name: SceneName
  city: City
  timeZone: string
  instant: Date
  caption: string
}

/** Deterministic when a seed is given, so a gallery can be reproduced. */
function shuffle<T>(items: T[], seed: number): T[] {
  let state = seed || Math.floor(Math.random() * 2 ** 31)
  const random = () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }

  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap]!, copy[index]!]
  }
  return copy
}

function eventsFor(city: City, day: Date, timeZone: string): SunEvents {
  return sunEvents(
    utcDateOfLocalNoon(day, timeZone, city.longitude),
    city.latitude,
    city.longitude,
  )
}

/** Local clock time on the day of an instant, as an absolute instant. */
function atLocalHour(instant: Date, timeZone: string, hour: number): Date {
  return instantFromZoned(zonedParts(instant, timeZone), hour, timeZone)
}

function instantFor(
  scene: SceneName,
  city: City,
  timeZone: string,
  reference: Date,
): Date {
  const events = eventsFor(city, reference, timeZone)

  switch (scene) {
    case 'dawn':
      // Between first light and sunrise, where the dawn palette is strongest.
      return midpoint(events.civilDawn, events.sunrise, reference)
    case 'midday':
      return events.solarNoon
    case 'golden-hour':
      return midpoint(events.goldenHourStart, events.sunset, reference)
    case 'dusk':
      return midpoint(events.sunset, events.civilDusk, reference)
    case 'full-moon': {
      // Late evening on the night the moon is full, so the disc is lit and the
      // sky is dark enough to show the night palette.
      const full = nextMoonPhase(reference, 180)
      const night = atLocalHour(full, timeZone, 22)
      return moonIllumination(night).fraction > 0.985 ? night : full
    }
  }
}

function midpoint(a: Date | null, b: Date | null, fallback: Date): Date {
  if (!a || !b) {
    return fallback
  }
  return new Date((a.getTime() + b.getTime()) / 2)
}

const CAPTIONS: Record<SceneName, string> = {
  dawn: 'First light, before sunrise',
  midday: 'Solar noon, the sun at its highest',
  'golden-hour': 'Golden hour',
  dusk: 'Civil twilight, after sunset',
  'full-moon': 'A full moon, late evening',
}

export interface SceneOptions {
  /** Timezone lookup, which the spec supplies from the app's own resolver. */
  timeZoneFor: (city: City) => string
  reference?: Date
  seed?: number
}

/** One scene per state, each in a different randomly chosen city. */
export function buildScenes({
  timeZoneFor,
  reference = new Date(),
  seed = 0,
}: SceneOptions): Scene[] {
  const cities = shuffle(US_CITIES, seed).slice(0, SCENE_NAMES.length)

  return SCENE_NAMES.map((name, index) => {
    const city = cities[index]!
    const timeZone = timeZoneFor(city)
    return {
      name,
      city,
      timeZone,
      instant: instantFor(name, city, timeZone, reference),
      caption: CAPTIONS[name],
    }
  })
}
