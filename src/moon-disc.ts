/**
 * Geometry for drawing the moon as it actually looks right now: the right
 * amount of the disc lit, and the crescent tilted the way it hangs in the sky
 * over this particular screen.
 */

import { cosDeg, RAD, sinDeg } from './astro/index.js'

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
 * sun, for a viewer facing the moon. Handles both hemispheres without a special
 * case: in the southern sky the sun simply sits on the other side.
 *
 * This is the position angle of the sun seen from the moon, measured on the
 * sphere from the zenith, less the quarter turn that takes the drawn limb from
 * pointing right to pointing up. Treating the sky as flat around the moon and
 * using the difference in azimuth instead is close enough while the two are
 * near each other, but it breaks at opposition: the azimuths are then 180 apart,
 * which is where the difference wraps, and the disc flips through half a turn
 * in a minute or two. That is every full moon, twice a day.
 */
export function brightLimbRotation(
  sun: HorizontalPoint,
  moon: HorizontalPoint,
): number {
  const deltaAzimuth = sun.azimuth - moon.azimuth
  const positionAngle =
    Math.atan2(
      cosDeg(sun.altitude) * sinDeg(deltaAzimuth),
      cosDeg(moon.altitude) * sinDeg(sun.altitude) -
        sinDeg(moon.altitude) * cosDeg(sun.altitude) * cosDeg(deltaAzimuth),
    ) * RAD

  return positionAngle - 90
}
