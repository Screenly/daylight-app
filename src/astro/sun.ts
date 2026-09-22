/**
 * Solar position and daily events, following the NOAA solar calculator
 * (Meeus, chapter 25). Accurate to well under a minute for the years a
 * signage player will ever run in.
 */

import {
  cosDeg,
  equatorialToHorizontal,
  hourAngleAtAltitude,
  julianCentury,
  julianDayFromUTC,
  MS_PER_MINUTE,
  normalizeDegrees,
  obliquityOfEcliptic,
  RAD,
  signedDegrees,
  sinDeg,
  tanDeg,
  toJulianDay,
} from './core.js'

/** Geometric altitude of the sun's centre at sunrise and sunset. */
export const HORIZON_ALTITUDE = -0.833
export const CIVIL_ALTITUDE = -6
export const NAUTICAL_ALTITUDE = -12
export const ASTRONOMICAL_ALTITUDE = -18
/** Upper bound of golden hour; below this the light turns warm. */
export const GOLDEN_HOUR_ALTITUDE = 6

function sunMeanLongitude(century: number): number {
  return normalizeDegrees(
    280.46646 + century * (36000.76983 + century * 0.0003032),
  )
}

function sunMeanAnomaly(century: number): number {
  return 357.52911 + century * (35999.05029 - 0.0001537 * century)
}

function sunEccentricity(century: number): number {
  return 0.016708634 - century * (0.000042037 + 0.0000001267 * century)
}

/** Correction from the sun's elliptical orbit, in degrees. */
function equationOfCentre(century: number): number {
  const meanAnomaly = sunMeanAnomaly(century)
  return (
    sinDeg(meanAnomaly) *
      (1.914602 - century * (0.004817 + 0.000014 * century)) +
    sinDeg(2 * meanAnomaly) * (0.019993 - 0.000101 * century) +
    sinDeg(3 * meanAnomaly) * 0.000289
  )
}

/** Sun's apparent ecliptic longitude in degrees. */
export function sunApparentLongitude(century: number): number {
  const omega = 125.04 - 1934.136 * century
  return (
    sunMeanLongitude(century) +
    equationOfCentre(century) -
    0.00569 -
    0.00478 * sinDeg(omega)
  )
}

/** Sun's declination in degrees. */
export function sunDeclination(century: number): number {
  const obliquity = obliquityOfEcliptic(century)
  return (
    Math.asin(sinDeg(obliquity) * sinDeg(sunApparentLongitude(century))) * RAD
  )
}

/** Distance to the sun in kilometres. */
export function sunDistance(century: number): number {
  const eccentricity = sunEccentricity(century)
  const trueAnomaly = sunMeanAnomaly(century) + equationOfCentre(century)
  const astronomicalUnits =
    (1.000001018 * (1 - eccentricity * eccentricity)) /
    (1 + eccentricity * cosDeg(trueAnomaly))
  return astronomicalUnits * 149597870.7
}

/**
 * Difference between apparent and mean solar time, in minutes. This is what
 * makes solar noon drift away from clock noon over the year.
 */
export function equationOfTime(century: number): number {
  const meanLongitude = sunMeanLongitude(century)
  const meanAnomaly = sunMeanAnomaly(century)
  const eccentricity = sunEccentricity(century)
  const obliquity = obliquityOfEcliptic(century)
  const y = tanDeg(obliquity / 2) ** 2

  const radians =
    y * sinDeg(2 * meanLongitude) -
    2 * eccentricity * sinDeg(meanAnomaly) +
    4 * eccentricity * y * sinDeg(meanAnomaly) * cosDeg(2 * meanLongitude) -
    0.5 * y * y * sinDeg(4 * meanLongitude) -
    1.25 * eccentricity * eccentricity * sinDeg(2 * meanAnomaly)

  return radians * RAD * 4
}

export interface SunPosition {
  altitude: number
  azimuth: number
  declination: number
  /** Degrees west of the meridian; zero at solar noon. */
  hourAngle: number
}

export function sunPosition(
  date: Date,
  latitude: number,
  longitude: number,
): SunPosition {
  const century = julianCentury(toJulianDay(date))
  const declination = sunDeclination(century)
  const minutesUTC =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000
  const trueSolarTime = minutesUTC + equationOfTime(century) + 4 * longitude
  const hourAngle = signedDegrees(trueSolarTime / 4 - 180)
  const { altitude, azimuth } = equatorialToHorizontal(
    hourAngle,
    declination,
    latitude,
  )
  return { altitude, azimuth, declination, hourAngle }
}

/** A calendar date, as the observer's clock would show it. */
export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface SunEvents {
  solarNoon: Date
  sunrise: Date | null
  sunset: Date | null
  civilDawn: Date | null
  civilDusk: Date | null
  nauticalDawn: Date | null
  nauticalDusk: Date | null
  astronomicalDawn: Date | null
  astronomicalDusk: Date | null
  goldenHourEnd: Date | null
  goldenHourStart: Date | null
  /** Minutes between sunrise and sunset. */
  dayLengthMinutes: number
  /** Set when the sun stays up or stays down for the whole day. */
  polar: 'midnight-sun' | 'polar-night' | null
}

/**
 * Sun events for one UTC calendar day at the given position.
 *
 * Pass the UTC date that contains the observer's local noon, which
 * `utcDateOfLocalNoon` in `timezone.ts` works out, so the events line up with
 * the local day.
 */
export function sunEvents(
  date: CalendarDate,
  latitude: number,
  longitude: number,
): SunEvents {
  const midnight = julianDayFromUTC(date.year, date.month, date.day)
  const century = julianCentury(midnight + 0.5 - longitude / 360)
  const declination = sunDeclination(century)
  const noonMinutes = 720 - 4 * longitude - equationOfTime(century)

  const at = (minutes: number): Date =>
    new Date(
      Date.UTC(date.year, date.month - 1, date.day) + minutes * MS_PER_MINUTE,
    )

  const eventPair = (
    altitude: number,
  ): [Date | null, Date | null, number | null] => {
    const hourAngle = hourAngleAtAltitude(altitude, latitude, declination)
    if (hourAngle === null) {
      return [null, null, null]
    }
    return [
      at(noonMinutes - 4 * hourAngle),
      at(noonMinutes + 4 * hourAngle),
      hourAngle,
    ]
  }

  const [sunrise, sunset, sunHourAngle] = eventPair(HORIZON_ALTITUDE)
  const [civilDawn, civilDusk] = eventPair(CIVIL_ALTITUDE)
  const [nauticalDawn, nauticalDusk] = eventPair(NAUTICAL_ALTITUDE)
  const [astronomicalDawn, astronomicalDusk] = eventPair(ASTRONOMICAL_ALTITUDE)
  const [goldenHourEnd, goldenHourStart] = eventPair(GOLDEN_HOUR_ALTITUDE)

  let polar: SunEvents['polar'] = null
  if (sunHourAngle === null) {
    const noonAltitude = 90 - Math.abs(latitude - declination)
    polar = noonAltitude > HORIZON_ALTITUDE ? 'midnight-sun' : 'polar-night'
  }

  return {
    solarNoon: at(noonMinutes),
    sunrise,
    sunset,
    civilDawn,
    civilDusk,
    nauticalDawn,
    nauticalDusk,
    astronomicalDawn,
    astronomicalDusk,
    goldenHourEnd,
    goldenHourStart,
    dayLengthMinutes:
      sunHourAngle === null
        ? polar === 'midnight-sun'
          ? 1440
          : 0
        : sunHourAngle * 8,
    polar,
  }
}
