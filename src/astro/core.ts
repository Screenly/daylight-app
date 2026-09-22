/**
 * Shared astronomical primitives.
 *
 * Everything here is pure arithmetic on a timestamp and a position, so the
 * whole app runs with no network access at all.
 */

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

/** Julian Day number for the Unix epoch (1970-01-01T00:00:00Z). */
const JD_UNIX_EPOCH = 2440587.5

/** Julian Day number of the J2000.0 epoch (2000-01-01T12:00:00 TT). */
export const JD_J2000 = 2451545

export const MS_PER_DAY = 86400000
export const MS_PER_MINUTE = 60000

/** Wrap an angle in degrees into [0, 360). */
export function normalizeDegrees(angle: number): number {
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** Wrap an angle in degrees into [-180, 180). */
export function signedDegrees(angle: number): number {
  return normalizeDegrees(angle + 180) - 180
}

export function sinDeg(angle: number): number {
  return Math.sin(angle * DEG)
}

export function cosDeg(angle: number): number {
  return Math.cos(angle * DEG)
}

export function tanDeg(angle: number): number {
  return Math.tan(angle * DEG)
}

export function toJulianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH
}

/** Days elapsed since J2000.0, the argument most of the series below take. */
export function daysSinceJ2000(date: Date): number {
  return toJulianDay(date) - JD_J2000
}

/** Julian centuries since J2000.0. */
export function julianCentury(julianDay: number): number {
  return (julianDay - JD_J2000) / 36525
}

/** Julian Day at 00:00 UTC of the given calendar date. */
export function julianDayFromUTC(
  year: number,
  month: number,
  day: number,
): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY + JD_UNIX_EPOCH
}

/**
 * Mean obliquity of the ecliptic with the nutation correction applied
 * (Meeus, Astronomical Algorithms, chapter 22).
 */
export function obliquityOfEcliptic(century: number): number {
  const seconds =
    21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))
  const mean = 23 + (26 + seconds / 60) / 60
  const omega = 125.04 - 1934.136 * century
  return mean + 0.00256 * cosDeg(omega)
}

/** Greenwich mean sidereal time in degrees. */
export function siderealTime(date: Date): number {
  return normalizeDegrees(280.16 + 360.9856235 * daysSinceJ2000(date))
}

export interface EquatorialCoordinates {
  /** Right ascension in degrees. */
  rightAscension: number
  /** Declination in degrees. */
  declination: number
}

/** Convert ecliptic longitude/latitude to right ascension/declination. */
export function eclipticToEquatorial(
  longitude: number,
  latitude: number,
  obliquity: number,
): EquatorialCoordinates {
  const declination = Math.asin(
    sinDeg(latitude) * cosDeg(obliquity) +
      cosDeg(latitude) * sinDeg(obliquity) * sinDeg(longitude),
  )
  const rightAscension = Math.atan2(
    sinDeg(longitude) * cosDeg(obliquity) -
      tanDeg(latitude) * sinDeg(obliquity),
    cosDeg(longitude),
  )
  return {
    rightAscension: normalizeDegrees(rightAscension * RAD),
    declination: declination * RAD,
  }
}

export interface HorizontalCoordinates {
  /** Degrees above the horizon; negative when below. */
  altitude: number
  /** Degrees clockwise from true north. */
  azimuth: number
}

/**
 * Convert an hour angle and declination to altitude and azimuth for an
 * observer at the given latitude.
 */
export function equatorialToHorizontal(
  hourAngle: number,
  declination: number,
  latitude: number,
): HorizontalCoordinates {
  const altitude = Math.asin(
    sinDeg(latitude) * sinDeg(declination) +
      cosDeg(latitude) * cosDeg(declination) * cosDeg(hourAngle),
  )
  const azimuth = Math.atan2(
    sinDeg(hourAngle),
    cosDeg(hourAngle) * sinDeg(latitude) -
      tanDeg(declination) * cosDeg(latitude),
  )
  return {
    altitude: altitude * RAD,
    azimuth: normalizeDegrees(azimuth * RAD + 180),
  }
}

/**
 * Hour angle, in degrees, at which a body of the given declination reaches
 * `targetAltitude` for an observer at `latitude`.
 *
 * Returns null when the body never reaches that altitude, which is the polar
 * day and polar night case.
 */
export function hourAngleAtAltitude(
  targetAltitude: number,
  latitude: number,
  declination: number,
): number | null {
  const cosHourAngle =
    (sinDeg(targetAltitude) - sinDeg(latitude) * sinDeg(declination)) /
    (cosDeg(latitude) * cosDeg(declination))
  if (cosHourAngle > 1 || cosHourAngle < -1) {
    return null
  }
  return Math.acos(cosHourAngle) * RAD
}

/**
 * Find the instant between `start` and `end` where `value` crosses zero,
 * assuming exactly one crossing. Used to refine the coarse scans that locate
 * rise/set times and lunar phases.
 */
export function bisect(
  value: (date: Date) => number,
  start: Date,
  end: Date,
  iterations = 40,
): Date {
  let low = start.getTime()
  let high = end.getTime()
  const lowValue = value(new Date(low))

  for (let i = 0; i < iterations; i += 1) {
    const middle = (low + high) / 2
    const middleValue = value(new Date(middle))
    if (middleValue === 0) {
      return new Date(middle)
    }
    if (middleValue > 0 === lowValue > 0) {
      low = middle
    } else {
      high = middle
    }
  }

  return new Date((low + high) / 2)
}
