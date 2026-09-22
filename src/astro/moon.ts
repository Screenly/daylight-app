/**
 * Lunar position, phase and rise/set times.
 *
 * Uses the abbreviated ELP series from Meeus chapter 47 (the largest nine
 * longitude terms and four latitude terms), which holds the moon's position to
 * a few arcminutes. Far tighter than anything a viewer standing in front of a
 * screen could notice.
 */

import {
  bisect,
  cosDeg,
  daysSinceJ2000,
  eclipticToEquatorial,
  equatorialToHorizontal,
  julianCentury,
  MS_PER_DAY,
  normalizeDegrees,
  obliquityOfEcliptic,
  RAD,
  siderealTime,
  sinDeg,
  tanDeg,
  toJulianDay,
} from './core.js'
import { sunApparentLongitude, sunDistance } from './sun.js'

/** Mean length of a lunation in days. */
export const SYNODIC_MONTH = 29.530588861

/**
 * Geocentric altitude at which the moon's upper limb touches the horizon,
 * once refraction, semidiameter and parallax cancel out.
 */
const MOON_HORIZON_ALTITUDE = 0.125

export interface MoonCoordinates {
  /** Ecliptic longitude in degrees. */
  longitude: number
  /** Ecliptic latitude in degrees. */
  latitude: number
  /** Distance from the centre of the earth in kilometres. */
  distance: number
}

export function moonCoordinates(date: Date): MoonCoordinates {
  const d = daysSinceJ2000(date)

  const meanLongitude = 218.316 + 13.176396 * d
  const meanAnomaly = 134.963 + 13.064993 * d
  const argumentOfLatitude = 93.272 + 13.22935 * d
  const elongation = 297.85 + 12.190749 * d
  const sunAnomaly = 357.529 + 0.98560028 * d

  const longitude =
    meanLongitude +
    6.289 * sinDeg(meanAnomaly) +
    1.274 * sinDeg(2 * elongation - meanAnomaly) +
    0.658 * sinDeg(2 * elongation) +
    0.214 * sinDeg(2 * meanAnomaly) -
    0.186 * sinDeg(sunAnomaly) -
    0.114 * sinDeg(2 * argumentOfLatitude) +
    0.059 * sinDeg(2 * elongation - 2 * meanAnomaly) +
    0.057 * sinDeg(2 * elongation - sunAnomaly - meanAnomaly)

  const latitude =
    5.128 * sinDeg(argumentOfLatitude) +
    0.281 * sinDeg(meanAnomaly + argumentOfLatitude) -
    0.278 * sinDeg(argumentOfLatitude - meanAnomaly) -
    0.173 * sinDeg(argumentOfLatitude - 2 * elongation)

  const distance =
    385001 -
    20905 * cosDeg(meanAnomaly) -
    3699 * cosDeg(2 * elongation - meanAnomaly) -
    2956 * cosDeg(2 * elongation) -
    570 * cosDeg(2 * meanAnomaly)

  return { longitude: normalizeDegrees(longitude), latitude, distance }
}

export interface MoonPosition {
  altitude: number
  azimuth: number
  distance: number
  /**
   * Angle in degrees between the moon's north pole and the local zenith. The
   * crescent leans by this much as the moon crosses the sky.
   */
  parallacticAngle: number
}

export function moonPosition(
  date: Date,
  latitude: number,
  longitude: number,
): MoonPosition {
  const coordinates = moonCoordinates(date)
  const obliquity = obliquityOfEcliptic(julianCentury(toJulianDay(date)))
  const equatorial = eclipticToEquatorial(
    coordinates.longitude,
    coordinates.latitude,
    obliquity,
  )
  const hourAngle = siderealTime(date) + longitude - equatorial.rightAscension
  const horizontal = equatorialToHorizontal(
    hourAngle,
    equatorial.declination,
    latitude,
  )
  const parallacticAngle =
    Math.atan2(
      sinDeg(hourAngle),
      tanDeg(latitude) * cosDeg(equatorial.declination) -
        sinDeg(equatorial.declination) * cosDeg(hourAngle),
    ) * RAD

  return {
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth,
    distance: coordinates.distance,
    parallacticAngle,
  }
}

/**
 * Angular distance between sun and moon along the ecliptic, in degrees.
 * Zero at new moon, 180 at full moon, and it increases steadily in between,
 * which makes it a clean quantity to solve for.
 */
export function moonElongation(date: Date): number {
  const century = julianCentury(toJulianDay(date))
  return normalizeDegrees(
    moonCoordinates(date).longitude - sunApparentLongitude(century),
  )
}

export interface MoonIllumination {
  /** Elongation from the sun in degrees. */
  elongation: number
  /** Fraction of the visible disc that is lit, 0 to 1. */
  fraction: number
  /** Position in the cycle: 0 is new, 0.25 first quarter, 0.5 full. */
  phase: number
  waxing: boolean
  /** Days since the last new moon. */
  age: number
}

export function moonIllumination(date: Date): MoonIllumination {
  const elongation = moonElongation(date)
  const century = julianCentury(toJulianDay(date))
  const { distance } = moonCoordinates(date)
  const earthSunDistance = sunDistance(century)

  // Convert elongation seen from earth into the sun-moon-earth phase angle,
  // then into a lit fraction.
  const phaseAngle = Math.atan2(
    earthSunDistance * sinDeg(elongation),
    distance - earthSunDistance * cosDeg(elongation),
  )

  return {
    elongation,
    fraction: (1 + Math.cos(phaseAngle)) / 2,
    phase: elongation / 360,
    waxing: elongation < 180,
    age: (elongation / 360) * SYNODIC_MONTH,
  }
}

export type MoonPhaseName =
  | 'New moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent'

/**
 * Name the phase from how much of the disc is lit, so the label can never
 * contradict the drawn moon. Splitting the cycle into eight equal sectors
 * instead would call a 31% crescent a first quarter for a day and a half
 * either side of the real quarter.
 */
export function moonPhaseName(illumination: MoonIllumination): MoonPhaseName {
  const { fraction, waxing } = illumination

  if (fraction <= 0.02) {
    return 'New moon'
  }
  if (fraction >= 0.98) {
    return 'Full moon'
  }
  if (fraction >= 0.46 && fraction <= 0.54) {
    return waxing ? 'First quarter' : 'Last quarter'
  }
  if (fraction < 0.46) {
    return waxing ? 'Waxing crescent' : 'Waning crescent'
  }
  return waxing ? 'Waxing gibbous' : 'Waning gibbous'
}

/**
 * Next instant after `from` at which the moon reaches the given elongation.
 * Use 0 for the new moon and 180 for the full moon.
 */
export function nextMoonPhase(from: Date, targetElongation: number): Date {
  const offset = (date: Date): number => {
    const difference = moonElongation(date) - targetElongation
    return normalizeDegrees(difference + 180) - 180
  }

  const stepMs = MS_PER_DAY / 4
  let previous = from
  let previousOffset = offset(previous)

  for (let step = 1; step <= SYNODIC_MONTH * 4 + 4; step += 1) {
    const current = new Date(from.getTime() + step * stepMs)
    const currentOffset = offset(current)
    if (previousOffset < 0 && currentOffset >= 0) {
      return bisect(offset, previous, current)
    }
    previous = current
    previousOffset = currentOffset
  }

  return new Date(from.getTime() + SYNODIC_MONTH * MS_PER_DAY)
}

export interface MoonEvents {
  rise: Date | null
  set: Date | null
  /** True when the moon is above the horizon for the whole window. */
  alwaysUp: boolean
  alwaysDown: boolean
}

/**
 * Moonrise and moonset inside a window, found by walking the altitude curve in
 * ten-minute steps and refining each crossing. The moon moves too fast for the
 * closed-form approach used for the sun.
 */
export function moonEvents(
  start: Date,
  end: Date,
  latitude: number,
  longitude: number,
): MoonEvents {
  const altitudeAboveHorizon = (date: Date): number =>
    moonPosition(date, latitude, longitude).altitude - MOON_HORIZON_ALTITUDE

  const stepMs = 10 * 60000
  let rise: Date | null = null
  let set: Date | null = null
  let previous = start
  let previousAltitude = altitudeAboveHorizon(previous)
  const startedUp = previousAltitude > 0
  let everUp = startedUp
  let everDown = !startedUp

  for (
    let time = start.getTime() + stepMs;
    time <= end.getTime();
    time += stepMs
  ) {
    const current = new Date(time)
    const currentAltitude = altitudeAboveHorizon(current)
    everUp = everUp || currentAltitude > 0
    everDown = everDown || currentAltitude <= 0

    if (previousAltitude <= 0 && currentAltitude > 0 && !rise) {
      rise = bisect(altitudeAboveHorizon, previous, current)
    }
    if (previousAltitude > 0 && currentAltitude <= 0 && !set) {
      set = bisect(altitudeAboveHorizon, previous, current)
    }

    previous = current
    previousAltitude = currentAltitude
  }

  return { rise, set, alwaysUp: !everDown, alwaysDown: !everUp }
}
