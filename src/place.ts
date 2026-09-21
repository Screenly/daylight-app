/**
 * Where this screen is, and how it writes clocks and dates.
 *
 * Everything comes from the player's own metadata and settings. Nothing is
 * reverse geocoded: the backend has no coordinates-to-city path, and the
 * offline city dataset on the player is too coarse to name a city reliably, so
 * the heading is whatever the screen itself was configured with.
 */

import tzlookup from '@photostructure/tz-lookup'
import { getMetadata, getSettingWithDefault } from '@screenly/edge-apps'

import { displayLocale } from './format.js'
import { parseCityName } from './location.js'

export interface Place {
  latitude: number
  longitude: number
  timeZone: string
  /** Always English; the region only decides date and clock conventions. */
  locale: string
  /** Clock style, from the `clock_format` setting. */
  hour12: boolean
  /** Heading text, or null when the screen has no location set. */
  name: string | null
  /** True when the screen has no position of its own and none was configured. */
  unlocated: boolean
}

interface ScreenCoordinates {
  latitude: number
  longitude: number
  /** The screen reported no position, so these are a placeholder. */
  unlocated: boolean
}

/**
 * Coordinates from the screen's metadata, overridable for players without a
 * fix. The backend sends them as strings and falls back to (0, 0) when the
 * geolocation task has not run, so neither is trusted here.
 */
function resolveCoordinates(): ScreenCoordinates {
  const override = getSettingWithDefault<string>('override_coordinates', '')
  const parts = override.split(',').map((part) => Number(part.trim()))
  if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
    const [latitude, longitude] = parts as [number, number]
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude, longitude, unlocated: false }
    }
  }

  const [rawLatitude, rawLongitude] = getMetadata().coordinates
  const latitude = Number(rawLatitude)
  const longitude = Number(rawLongitude)

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return { latitude: 0, longitude: 0, unlocated: true }
  }

  return { latitude, longitude, unlocated: false }
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * The timezone of the position the sky is computed for, so an override of the
 * coordinates moves the clock with the sun. The library's own `getTimeZone`
 * only ever looks at the screen's metadata coordinates.
 */
function resolveTimeZone(coordinates: ScreenCoordinates): string {
  const override = getSettingWithDefault<string>('override_timezone', '').trim()
  if (override) {
    if (isValidTimeZone(override)) {
      return override
    }
    console.warn(`Invalid timezone override: "${override}", using coordinates`)
  }

  if (coordinates.unlocated) {
    return 'UTC'
  }

  try {
    return tzlookup(coordinates.latitude, coordinates.longitude)
  } catch (error) {
    console.warn('Failed to get timezone from coordinates, using UTC:', error)
    return 'UTC'
  }
}

export function resolvePlace(): Place {
  const coordinates = resolveCoordinates()
  const { latitude, longitude, unlocated } = coordinates
  const nameOverride = getSettingWithDefault<string>('location_name', '').trim()
  const timeZone = resolveTimeZone(coordinates)

  return {
    latitude,
    longitude,
    unlocated,
    timeZone,
    locale: displayLocale(timeZone),
    hour12: getSettingWithDefault<string>('clock_format', '24h') === '12h',
    name: nameOverride || parseCityName(getMetadata().location),
  }
}
