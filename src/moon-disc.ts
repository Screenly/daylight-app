/**
 * Geometry for drawing the moon as it actually looks right now: the right
 * amount of the disc lit, and the crescent tilted the way it hangs in the sky
 * over this particular screen.
 */

import { DEG, RAD, signedDegrees } from './astro/index.js'

export interface HorizontalPoint {
  altitude: number
  azimuth: number
}

/**
 * SVG path for the lit part of the disc, drawn with the bright limb pointing
 * along positive x. Rotate it by `brightLimbRotation` to place it correctly.
 */
export function litLimbPath(fraction: number, radius: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1)
  // cos of the phase angle: +1 at full, -1 at new. The terminator is an
  // ellipse whose x radius is the disc radius scaled by this value.
  const terminator = 2 * clamped - 1
  const terminatorRadius = Math.abs(terminator) * radius
  // Sweeping clockwise from the bottom passes left of centre, which is what a
  // gibbous moon needs; a crescent needs the arc to bow the other way.
  const sweep = terminator >= 0 ? 1 : 0

  return [
    `M 0 ${-radius}`,
    `A ${radius} ${radius} 0 0 1 0 ${radius}`,
    `A ${terminatorRadius} ${radius} 0 0 ${sweep} 0 ${-radius}`,
    'Z',
  ].join(' ')
}

/**
 * Degrees to rotate the lit limb clockwise on screen so that it points at the
 * sun, for a viewer facing the moon. Handles both hemispheres without a
 * special case: in the southern sky the sun simply sits on the other side.
 */
export function brightLimbRotation(
  sun: HorizontalPoint,
  moon: HorizontalPoint,
): number {
  const acrossSky =
    signedDegrees(sun.azimuth - moon.azimuth) * Math.cos(moon.altitude * DEG)
  const upSky = sun.altitude - moon.altitude
  // Screen y grows downward, so a sun that is lower in the sky rotates the
  // bright limb clockwise.
  return Math.atan2(-upSky, acrossSky) * RAD
}
