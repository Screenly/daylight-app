/**
 * The instant the screen is drawing.
 *
 * In production this is simply the system clock. The development time machine
 * overrides it so every state of the sky (dawn, golden hour, a polar night, a
 * full moon) can be reached without waiting for it.
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
