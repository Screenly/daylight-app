/**
 * Rendering. Each function owns one region of the screen and takes the model
 * for the current instant, so a redraw is a straight overwrite.
 */

import {
  ASTRONOMICAL_ALTITUDE,
  CIVIL_ALTITUDE,
  HORIZON_ALTITUDE,
  NAUTICAL_ALTITUDE,
  sunPosition,
  type SunEvents,
} from './astro/index.js'
import {
  CHART_WIDTH,
  hourTicks,
  renderChart,
  type ChartMarker,
} from './chart.js'
import { escapeText } from './escape.js'
import { fitToWidth } from './fit-text.js'
import {
  formatClock,
  formatClockRange,
  formatCompass,
  formatCoordinates,
  formatCountdown,
  formatDegrees,
  formatDuration,
  formatShortDate,
  formatSignedDuration,
} from './format.js'
import { brightLimbRotation, litLimbPath } from './moon-disc.js'
import type { Place } from './place.js'
import {
  fractionOfDay,
  fractionOfLocalHour,
  type SkyModel,
} from './view-model.js'

const MOON_RADIUS = 100

/** Type sizes before `fitDynamicText` scales them to the space available. */
export const CITY_SIZE = { landscape: 64, portrait: 74 }
const CITY_MIN_SIZE = 30
const STAT_LABEL_SIZE = 19
const STAT_LABEL_MIN_SIZE = 12
const STAT_VALUE_SIZE = 42
const STAT_VALUE_MIN_SIZE = 24

/** Craters, placed by hand so the disc does not read as a flat circle. */
const CRATERS = [
  { x: -34, y: -30, r: 24 },
  { x: 12, y: -52, r: 15 },
  { x: 40, y: -14, r: 27 },
  { x: -12, y: 26, r: 19 },
  { x: 46, y: 44, r: 13 },
  { x: -52, y: 34, r: 11 },
]

export function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) {
    throw new Error(`Missing element: ${selector}`)
  }
  return found
}

/**
 * Name the light for a geometric sun altitude. Daylight starts where sunrise is
 * solved (the upper limb on the horizon, refracted), so the label agrees with
 * the headline's countdown.
 */
export function twilightName(altitude: number): string {
  if (altitude >= HORIZON_ALTITUDE) {
    return 'Daylight'
  }
  if (altitude >= CIVIL_ALTITUDE) {
    return 'Civil twilight'
  }
  if (altitude >= NAUTICAL_ALTITUDE) {
    return 'Nautical twilight'
  }
  if (altitude >= ASTRONOMICAL_ALTITUDE) {
    return 'Astronomical twilight'
  }
  return 'Night'
}

export function headlineText(model: SkyModel, place: Place): string {
  if (model.events.polar === 'midnight-sun') {
    return 'Midnight sun · the sun never sets'
  }
  if (model.events.polar === 'polar-night') {
    return 'Polar night · the sun never rises'
  }
  if (!model.nextSunEvent) {
    return twilightName(model.sun.altitude)
  }

  const minutes =
    (model.nextSunEvent.date.getTime() - model.now.getTime()) / 60000
  const when =
    minutes < 1
      ? 'now'
      : `in ${formatDuration(minutes)} · ${formatClock(
          model.nextSunEvent.date,
          place.locale,
          place.timeZone,
          place.hour12,
        )}`
  return `${model.nextSunEvent.label} ${when}`
}

export function subheadText(model: SkyModel): string {
  const altitude = model.sun.altitude
  if (altitude >= HORIZON_ALTITUDE) {
    return `Sun ${formatDegrees(
      Math.max(altitude, 0),
    )} above the horizon, bearing ${formatCompass(model.sun.azimuth)}`
  }
  // Capitalised on both sides of the separator, as in the daytime text above.
  return `${twilightName(altitude)} · Sun ${formatDegrees(
    Math.abs(altitude),
  )} below the horizon`
}

function chartMarkers(model: SkyModel, place: Place): ChartMarker[] {
  const markers: ChartMarker[] = []
  const add = (date: Date | null, label: string, side: 'left' | 'right') => {
    if (!date) {
      return
    }
    const fraction = fractionOfDay(model, date)
    if (fraction === null) {
      return
    }
    markers.push({
      fraction,
      altitude: 0,
      side,
      label: `${label} ${formatClock(date, place.locale, place.timeZone, place.hour12)}`,
    })
  }

  // Neighbouring days too: at high latitudes a sunset can land after local
  // midnight, and it belongs on the day it is seen.
  const days: SunEvents[] = [
    model.yesterdayEvents,
    model.events,
    model.tomorrowEvents,
  ]
  for (const day of days) {
    add(day.sunrise, 'Sunrise', 'right')
    add(day.sunset, 'Sunset', 'left')
  }
  return markers
}

export function renderChartInto(
  model: SkyModel,
  place: Place,
  height: number,
): void {
  const chart = element<SVGSVGElement>('[data-chart]')
  chart.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${height}`)
  chart.innerHTML = renderChart({
    height,
    path: model.path,
    nowFraction: model.nowFraction,
    nowAltitude: model.sun.altitude,
    ticks: hourTicks(place.locale, place.hour12, (hour) =>
      fractionOfLocalHour(model, hour),
    ),
    markers: chartMarkers(model, place),
  })
}

export interface PlaceHeading {
  heading: string
  /** The line under the heading, or null when it would only repeat it. */
  meta: string | null
}

/**
 * What to put at the top left. A screen that knows where it is but has no name
 * leads with its coordinates; one with no position at all says so, rather than
 * presenting the sky over Null Island as if it were meant.
 */
export function placeHeading(place: Place): PlaceHeading {
  const detail = place.unlocated
    ? 'No location set'
    : formatCoordinates(place.latitude, place.longitude)

  // A configured name survives a missing position; the notice goes beneath it.
  return place.name
    ? { heading: place.name, meta: detail }
    : { heading: detail, meta: null }
}

/** Draw the heading and the line under it. Sizing happens in `fitDynamicText`. */
export function renderPlaceHeading(place: Place): void {
  const { heading, meta } = placeHeading(place)

  const headingElement = element<HTMLElement>('[data-city]')
  headingElement.textContent = heading

  const metaElement = element<HTMLElement>('[data-place-meta]')
  metaElement.textContent = meta ?? ''
  metaElement.hidden = meta === null
}

export function renderMoon(model: SkyModel): void {
  const { illumination, position } = model.moon
  const rotation = brightLimbRotation(model.sun, position)
  const craters = CRATERS.map(
    (crater) =>
      `<circle class="moon-crater" cx="${crater.x}" cy="${crater.y}" r="${crater.r}" />`,
  ).join('')
  const litPath = litLimbPath(illumination.fraction, MOON_RADIUS)

  element('[data-moon]').innerHTML = `
    <defs>
      <clipPath id="moon-lit-clip"><path d="${litPath}" /></clipPath>
    </defs>
    <circle class="moon-dark" cx="0" cy="0" r="${MOON_RADIUS}" />
    <g transform="rotate(${rotation.toFixed(1)})">
      <path class="moon-lit" d="${litPath}" />
      <g clip-path="url(#moon-lit-clip)">${craters}</g>
    </g>
    <circle class="moon-rim" cx="0" cy="0" r="${MOON_RADIUS}" />
  `
}

function moonFact(label: string, value: string): string {
  return `<div class="moon-fact"><dt>${escapeText(
    label,
  )}</dt><dd>${escapeText(value)}</dd></div>`
}

export function renderMoonPanel(model: SkyModel, place: Place): void {
  const { illumination, events, nextFull, nextNew, phase } = model.moon
  const clock = (date: Date | null): string =>
    date ? formatClock(date, place.locale, place.timeZone, place.hour12) : '—'

  element('[data-moon-phase]').textContent = phase
  element('[data-moon-illumination]').textContent = `${Math.round(
    illumination.fraction * 100,
  )}% lit · ${illumination.age.toFixed(1)} days old`

  const nextPrincipal =
    nextFull.getTime() < nextNew.getTime()
      ? { label: 'Full moon', date: nextFull }
      : { label: 'New moon', date: nextNew }

  element('[data-moon-facts]').innerHTML = [
    moonFact('Moonrise', events.alwaysUp ? 'Up all day' : clock(events.rise)),
    moonFact('Moonset', events.alwaysDown ? 'Down all day' : clock(events.set)),
    moonFact(
      nextPrincipal.label,
      formatCountdown(nextPrincipal.date, model.now, place.locale),
    ),
  ].join('')
}

function statTile(label: string, value: string, note: string): string {
  return `
    <div class="stat">
      <div class="stat-label">${escapeText(label)}</div>
      <div class="stat-value">${escapeText(value)}</div>
      <div class="stat-note">${escapeText(note)}</div>
    </div>
  `
}

export function renderStats(model: SkyModel, place: Place): void {
  const { events } = model
  const { latitude, longitude, locale, timeZone, hour12 } = place
  const clock = (date: Date | null): string =>
    date ? formatClock(date, locale, timeZone, hour12) : '—'
  const bearing = (date: Date | null): string =>
    date ? formatCompass(sunPosition(date, latitude, longitude).azimuth) : ''

  const noonAltitude = sunPosition(
    events.solarNoon,
    latitude,
    longitude,
  ).altitude

  const golden = model.goldenHour
  const goldenValue = golden
    ? formatClockRange(golden.start, golden.end, locale, timeZone, hour12)
    : '—'

  const dayLength =
    events.polar === 'midnight-sun'
      ? 'All day'
      : events.polar === 'polar-night'
        ? 'None'
        : formatDuration(events.dayLengthMinutes)

  element('[data-stats]').innerHTML = [
    statTile('Sunrise', clock(events.sunrise), bearing(events.sunrise)),
    statTile(
      'Solar noon',
      clock(events.solarNoon),
      `${formatDegrees(noonAltitude)} above the horizon`,
    ),
    statTile('Sunset', clock(events.sunset), bearing(events.sunset)),
    statTile(
      'Daylight',
      dayLength,
      `${formatSignedDuration(model.dayLengthDeltaSeconds)} on yesterday`,
    ),
    statTile('Golden hour', goldenValue, golden?.note ?? ''),
    statTile(
      model.season.name,
      formatCountdown(model.season.date, model.now, locale),
      formatShortDate(model.season.date, locale, timeZone),
    ),
  ].join('')
}

export function applySky(model: SkyModel): void {
  const root = document.documentElement.style
  root.setProperty('--sky-zenith', model.sky.zenith)
  root.setProperty('--sky-horizon', model.sky.horizon)
  root.setProperty('--sky-glow', model.sky.glow)
  root.setProperty('--sky-scrim', String(model.sky.scrim))
}

/**
 * Scale the text that varies in width down to one line.
 *
 * Run after the screen is drawn, and again on the next frame: the first render
 * happens before <auto-scaler> has sized its box, and an unconstrained element
 * reports no overflow to correct.
 */
export function fitDynamicText(headingMaxSize: number): void {
  fitToWidth(element<HTMLElement>('[data-city]'), headingMaxSize, CITY_MIN_SIZE)

  document
    .querySelectorAll<HTMLElement>('.stat-label')
    .forEach((node) => fitToWidth(node, STAT_LABEL_SIZE, STAT_LABEL_MIN_SIZE))

  document
    .querySelectorAll<HTMLElement>('.stat-value')
    .forEach((node) => fitToWidth(node, STAT_VALUE_SIZE, STAT_VALUE_MIN_SIZE))
}
