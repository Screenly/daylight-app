/**
 * The instant the screen is drawing.
 *
 * Normally this is the system clock. The `playback` setting can freeze it at a
 * named sky moment or advance it while auto-playing through the day.
 */

let override: Date | null = null

export function setClockOverride(instant: Date | null): void {
  override = instant
}

export function isClockOverridden(): boolean {
  return override !== null
}

export function now(): Date {
  return override ? new Date(override.getTime()) : new Date()
}
