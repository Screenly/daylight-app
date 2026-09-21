/**
 * Playback mode from Screenly settings: live clock, auto-play through the day,
 * or freeze at a named sky moment.
 */

import { getSettingWithDefault } from '@screenly/edge-apps'

import { setClockOverride } from './clock.js'
import {
  instantForMoment,
  MOMENT_MODES,
  type MomentMode,
} from './playback-moments.js'
import type { Place } from './place.js'
import { instantFromZoned, zonedParts } from './timezone.js'

const MINUTES_PER_DAY = 1440
/** Minutes of sky time added per animation frame while auto-playing. */
const PLAY_SPEED = 2

export const PLAYBACK_MODES = ['live', 'auto_play', ...MOMENT_MODES] as const

export type PlaybackMode = (typeof PLAYBACK_MODES)[number]

export type { MomentMode }
export { instantForMoment }

function isPlaybackMode(value: string): value is PlaybackMode {
  return (PLAYBACK_MODES as readonly string[]).includes(value)
}

export function resolvePlaybackMode(): PlaybackMode {
  const raw = getSettingWithDefault<string>('playback', 'live').trim()
  if (isPlaybackMode(raw)) {
    return raw
  }
  console.warn(`Unknown playback setting "${raw}", using live`)
  return 'live'
}

/**
 * Apply the playback setting. Frozen modes set a clock override; auto play
 * advances the override on each animation frame and calls `onTick` to redraw.
 * Returns a stop function for auto play (no-op otherwise).
 */
export function applyPlayback(place: Place, onTick: () => void): () => void {
  const mode = resolvePlaybackMode()

  if (mode === 'live') {
    setClockOverride(null)
    return () => undefined
  }

  if (mode === 'auto_play') {
    return startAutoPlay(place, onTick)
  }

  const instant = instantForMoment(mode, place)
  if (!instant) {
    console.warn(
      `Playback "${mode}" is unavailable for this location and day; using live`,
    )
    setClockOverride(null)
    return () => undefined
  }

  setClockOverride(instant)
  return () => undefined
}

function startAutoPlay(place: Place, onTick: () => void): () => void {
  const start = new Date()
  const parts = zonedParts(start, place.timeZone)
  let day = { year: parts.year, month: parts.month, day: parts.day }
  let minutes = parts.hour * 60 + parts.minute
  let playing = true
  let frame = 0

  const emit = (): void => {
    setClockOverride(
      instantFromZoned(
        day,
        Math.floor(minutes / 60),
        place.timeZone,
        minutes % 60,
      ),
    )
    onTick()
  }

  const advanceDay = (): void => {
    const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1))
    day = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    }
  }

  const step = (): void => {
    if (!playing) {
      return
    }
    minutes += PLAY_SPEED
    if (minutes >= MINUTES_PER_DAY) {
      minutes -= MINUTES_PER_DAY
      advanceDay()
    }
    emit()
    frame = requestAnimationFrame(step)
  }

  emit()
  frame = requestAnimationFrame(step)

  return () => {
    playing = false
    cancelAnimationFrame(frame)
  }
}
