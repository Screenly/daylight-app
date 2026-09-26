/**
 * Named sky moments used by the `playback` setting.
 */

import type { Place } from './place.js'
import { buildSkyModel } from './view-model.js'

export const MOMENT_MODES = [
  'dawn',
  'sunrise',
  'noon',
  'sunset',
  'dusk',
  'night',
  'full_moon',
  'new_moon',
  'season',
] as const

export type MomentMode = (typeof MOMENT_MODES)[number]

export type PlaybackMode = 'live' | 'auto_play' | MomentMode

const PLAYBACK_LABELS: Record<Exclude<PlaybackMode, 'live'>, string> = {
  auto_play: 'Auto play',
  dawn: 'Dawn',
  sunrise: 'Sunrise',
  noon: 'Noon',
  sunset: 'Sunset',
  dusk: 'Dusk',
  night: 'Night',
  full_moon: 'Full moon',
  new_moon: 'New moon',
  season: 'Equinox / solstice',
}

/**
 * Short name for the active playback mode, or null in live mode so the UI
 * stays quiet on everyday screens.
 */
export function playbackLabel(mode: PlaybackMode): string | null {
  if (mode === 'live') {
    return null
  }
  return PLAYBACK_LABELS[mode]
}

/**
 * Instant for a frozen moment, or null when that event does not exist for the
 * local day containing `at` (defaults to now).
 */
export function instantForMoment(
  mode: MomentMode,
  place: Place,
  at: Date = new Date(),
): Date | null {
  const model = buildSkyModel(at, place)

  switch (mode) {
    case 'dawn':
      return model.events.civilDawn
    case 'sunrise':
      return model.events.sunrise
    case 'noon':
      return model.events.solarNoon
    case 'sunset':
      return model.events.sunset
    case 'dusk':
      return model.events.civilDusk
    case 'night':
      return model.events.astronomicalDusk
    case 'full_moon':
      return model.moon.nextFull
    case 'new_moon':
      return model.moon.nextNew
    case 'season':
      return model.season.date
  }
}
