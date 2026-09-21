/**
 * Scenes for the store screenshots: one US city per `playback` setting moment,
 * so the gallery shows what each setting looks like on a screen.
 *
 * Cities are drawn at random from a pool so the gallery is not always the same
 * set. The clock is frozen to a fixed reference day; the app's `playback`
 * setting then jumps to that day's dawn, sunrise, and so on.
 */

import { FIXED_SCREENSHOT_DATE } from '@screenly/edge-apps/test/screenshots'

import {
  instantForMoment,
  MOMENT_MODES,
  type MomentMode,
} from '../src/playback-moments.js'
import type { Place } from '../src/place.js'

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

/** Frozen `playback` values, in the order they read best in a gallery. */
export const SCENE_NAMES = MOMENT_MODES

export type SceneName = MomentMode

export interface Scene {
  name: SceneName
  /** Value passed as the Screenly `playback` setting. */
  playback: MomentMode
  city: City
  timeZone: string
  /** Clock freeze before the app applies `playback`. */
  reference: Date
  /** Instant the setting should land on, for captions. */
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

const CAPTIONS: Record<SceneName, string> = {
  dawn: 'Playback: dawn (civil twilight)',
  sunrise: 'Playback: sunrise',
  noon: 'Playback: solar noon',
  sunset: 'Playback: sunset',
  dusk: 'Playback: dusk (civil twilight)',
  night: 'Playback: night (astronomical dusk)',
  full_moon: 'Playback: next full moon',
  new_moon: 'Playback: next new moon',
  season: 'Playback: next equinox or solstice',
}

function placeFor(city: City, timeZone: string): Place {
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    timeZone,
    locale: 'en-US',
    hour12: true,
    name: city.name,
    unlocated: false,
  }
}

export interface SceneOptions {
  /** Timezone lookup, which the spec supplies from the app's own resolver. */
  timeZoneFor: (city: City) => string
  /** Shared clock freeze; defaults to the screenshot suite's fixed date. */
  reference?: Date
  seed?: number
}

/** One scene per playback moment, each in a different randomly chosen city. */
export function buildScenes({
  timeZoneFor,
  reference = FIXED_SCREENSHOT_DATE,
  seed = 0,
}: SceneOptions): Scene[] {
  const cities = shuffle(US_CITIES, seed).slice(0, SCENE_NAMES.length)

  return SCENE_NAMES.map((name, index) => {
    const city = cities[index]!
    const timeZone = timeZoneFor(city)
    const instant =
      instantForMoment(name, placeFor(city, timeZone), reference) ?? reference

    return {
      name,
      playback: name,
      city,
      timeZone,
      reference,
      instant,
      caption: CAPTIONS[name],
    }
  })
}
