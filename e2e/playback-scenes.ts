/**
 * San Francisco under each frozen `playback` setting, for screenshot galleries.
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

export const SAN_FRANCISCO: City = {
  name: 'San Francisco, CA',
  latitude: 37.7749,
  longitude: -122.4194,
}

export const SCENE_NAMES = MOMENT_MODES

export type SceneName = MomentMode

export interface Scene {
  name: SceneName
  playback: MomentMode
  city: City
  timeZone: string
  reference: Date
  instant: Date
  caption: string
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
    name: 'San Francisco',
    unlocated: false,
  }
}

export interface SceneOptions {
  timeZoneFor: (city: City) => string
  reference?: Date
}

/** One scene per playback moment, all in San Francisco. */
export function buildScenes({
  timeZoneFor,
  reference = FIXED_SCREENSHOT_DATE,
}: SceneOptions): Scene[] {
  const city = SAN_FRANCISCO
  const timeZone = timeZoneFor(city)

  return SCENE_NAMES.map((name) => {
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
