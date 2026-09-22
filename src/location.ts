/**
 * Reading a screen's `location` string.
 *
 * Kept free of platform imports so the parsing can be tested on its own.
 */

/** What the dev server calls an unconfigured screen. */
const DEV_PLACEHOLDER_LOCATIONS = ['Development Environment', 'Unknown']

/**
 * The city from a screen's `location`, taken as the part before the first
 * comma, which is how the web console reads the same field.
 *
 * The string has two shapes. IP geolocation writes "City, Country". A user who
 * picks an address from the settings field gets Google's formatted address
 * verbatim, so the first segment can be a street. The console accepts that
 * looseness, and matching it keeps the two surfaces consistent; the
 * `location_name` setting is the way out for a screen with an ugly address.
 *
 * Returns null when the screen has no location, so nothing is invented.
 */
export function parseCityName(location: string | undefined): string | null {
  const trimmed = location?.trim()
  if (!trimmed || DEV_PLACEHOLDER_LOCATIONS.includes(trimmed)) {
    return null
  }

  return trimmed.split(',')[0]!.trim() || null
}
