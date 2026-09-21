/**
 * The sun path chart: altitude against local time for the whole day, with the
 * twilight bands drawn to scale and the sun where it is right now.
 */

import {
  ASTRONOMICAL_ALTITUDE,
  CIVIL_ALTITUDE,
  NAUTICAL_ALTITUDE,
} from './astro/index.js'
import { escapeText } from './escape.js'
import type { SunSample } from './view-model.js'

export const CHART_WIDTH = 1200

/** Landscape leaves a wide, shallow plot; portrait has height to spare. */
export const LANDSCAPE_HEIGHT = 460
export const PORTRAIT_HEIGHT = 760

const MARGIN = { top: 26, right: 30, bottom: 64, left: 30 }
const PLOT_LEFT = MARGIN.left
const PLOT_RIGHT = CHART_WIDTH - MARGIN.right
const PLOT_TOP = MARGIN.top

function plotBottom(height: number): number {
  return height - MARGIN.bottom
}

export interface AltitudeScale {
  top: number
  bottom: number
}

/** Altitude range to draw, padded around the day's extremes. */
export function altitudeScale(path: SunSample[]): AltitudeScale {
  const altitudes = path.map((sample) => sample.altitude)
  const highest = Math.max(...altitudes)
  const lowest = Math.min(...altitudes)
  return {
    top: Math.min(Math.max(highest + 8, 22), 92),
    bottom: Math.max(Math.min(lowest - 8, -24), -92),
  }
}

export function xForFraction(fraction: number): number {
  return PLOT_LEFT + fraction * (PLOT_RIGHT - PLOT_LEFT)
}

export function yForAltitude(
  altitude: number,
  scale: AltitudeScale,
  height: number,
): number {
  const span = scale.top - scale.bottom
  const clamped = Math.min(Math.max(altitude, scale.bottom), scale.top)
  return (
    PLOT_TOP + ((scale.top - clamped) / span) * (plotBottom(height) - PLOT_TOP)
  )
}

interface Band {
  from: number
  to: number
  opacity: number
}

const BANDS: Band[] = [
  { from: 92, to: 0, opacity: 0.17 },
  { from: 0, to: CIVIL_ALTITUDE, opacity: 0.11 },
  { from: CIVIL_ALTITUDE, to: NAUTICAL_ALTITUDE, opacity: 0.07 },
  { from: NAUTICAL_ALTITUDE, to: ASTRONOMICAL_ALTITUDE, opacity: 0.035 },
  { from: ASTRONOMICAL_ALTITUDE, to: -92, opacity: 0 },
]

function bandMarkup(scale: AltitudeScale, height: number): string {
  return BANDS.map((band) => {
    const top = yForAltitude(band.from, scale, height)
    const bottom = yForAltitude(band.to, scale, height)
    if (bottom - top < 0.5) {
      return ''
    }
    return `<rect x="${PLOT_LEFT}" y="${top.toFixed(1)}" width="${
      PLOT_RIGHT - PLOT_LEFT
    }" height="${(bottom - top).toFixed(1)}" fill="#ffffff" opacity="${
      band.opacity
    }" />`
  }).join('')
}

function pathMarkup(
  path: SunSample[],
  scale: AltitudeScale,
  height: number,
): string {
  const points = path
    .map(
      (sample) =>
        `${xForFraction(sample.fraction).toFixed(1)},${yForAltitude(
          sample.altitude,
          scale,
          height,
        ).toFixed(1)}`,
    )
    .join(' ')

  const horizon = yForAltitude(0, scale, height)
  const daylight = `${points} ${PLOT_RIGHT},${horizon.toFixed(
    1,
  )} ${PLOT_LEFT},${horizon.toFixed(1)}`

  return `
    <clipPath id="above-horizon">
      <rect x="${PLOT_LEFT}" y="${PLOT_TOP}" width="${
        PLOT_RIGHT - PLOT_LEFT
      }" height="${(horizon - PLOT_TOP).toFixed(1)}" />
    </clipPath>
    <polygon class="sun-path-fill" points="${daylight}" clip-path="url(#above-horizon)" />
    <polyline class="sun-path-line" points="${points}" />
  `
}

export interface HourTick {
  fraction: number
  label: string
}

/** Where a wall-clock hour sits on the axis; null for an hour the clocks skip. */
export type HourPosition = (hour: number) => number | null

/** A 24 hour day with no clock change. */
export const evenHours: HourPosition = (hour) => hour / 24

/**
 * Tick positions across the day, labelled the way the locale writes an hour.
 * Twelve-hour locales get a mark every six hours because the labels are wider.
 *
 * The hours are positions on an axis rather than real instants, so they are
 * formatted against a fixed UTC date. Their positions come from the caller,
 * because the axis is the observer's local day and that is 23 or 25 hours
 * long when the clocks change.
 */
export function hourTicks(
  locale: string,
  hour12: boolean,
  position: HourPosition = evenHours,
): HourTick[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    hour: hour12 ? 'numeric' : '2-digit',
    hour12,
  })

  // Take the hour and its day period from the parts, so locales that append a
  // word to the hour (German's "13 Uhr") do not repeat it across the axis.
  const label = (hour: number): string => {
    const parts = formatter.formatToParts(new Date(Date.UTC(2001, 0, 1, hour)))
    const value = parts.find((part) => part.type === 'hour')?.value ?? ''
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value
    return dayPeriod ? `${value} ${dayPeriod}` : value
  }

  const step = hour12 ? 6 : 3
  const ticks: HourTick[] = []
  for (let hour = 0; hour <= 24; hour += step) {
    const fraction = position(hour)
    if (fraction !== null) {
      ticks.push({ fraction, label: label(hour % 24) })
    }
  }
  return ticks
}

function axisMarkup(
  ticks: HourTick[],
  scale: AltitudeScale,
  height: number,
): string {
  const horizon = yForAltitude(0, scale, height)
  const gridlines = ticks
    .map((tick) => {
      const x = xForFraction(tick.fraction).toFixed(1)
      return `<line class="chart-gridline" x1="${x}" y1="${PLOT_TOP}" x2="${x}" y2="${plotBottom(
        height,
      )}" />`
    })
    .join('')

  const labels = ticks
    .map((tick) => {
      const x = xForFraction(tick.fraction).toFixed(1)
      return `<text class="chart-axis-label" x="${x}" y="${
        plotBottom(height) + 34
      }" text-anchor="middle">${escapeText(tick.label)}</text>`
    })
    .join('')

  return `
    ${gridlines}
    <line class="chart-horizon" x1="${PLOT_LEFT}" y1="${horizon.toFixed(
      1,
    )}" x2="${PLOT_RIGHT}" y2="${horizon.toFixed(1)}" />
    <text class="chart-horizon-label" x="${
      PLOT_LEFT + 8
    }" y="${(horizon - 12).toFixed(1)}">Horizon</text>
    ${labels}
  `
}

export interface ChartMarker {
  fraction: number
  altitude: number
  label: string
  /**
   * Which side of the dot the label sits on. Both labels are pulled towards
   * the middle of the day so they land in the empty space under the curve
   * rather than across it.
   */
  side: 'left' | 'right'
}

function markerMarkup(
  markers: ChartMarker[],
  scale: AltitudeScale,
  height: number,
): string {
  return markers
    .map((marker) => {
      const x = xForFraction(marker.fraction)
      const y = yForAltitude(marker.altitude, scale, height)
      const toRight = marker.side === 'right'
      const labelX = x + (toRight ? 16 : -16)
      return `
        <circle class="chart-event-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(
          1,
        )}" r="7" />
        <text class="chart-event-label" x="${labelX.toFixed(1)}" y="${(
          y + 32
        ).toFixed(1)}" text-anchor="${
          toRight ? 'start' : 'end'
        }">${escapeText(marker.label)}</text>
      `
    })
    .join('')
}

function sunMarkup(
  fraction: number,
  altitude: number,
  scale: AltitudeScale,
  height: number,
): string {
  const x = xForFraction(fraction)
  const y = yForAltitude(altitude, scale, height)
  return `
    <line class="chart-now-line" x1="${x.toFixed(1)}" y1="${(y + 20).toFixed(
      1,
    )}" x2="${x.toFixed(1)}" y2="${plotBottom(height)}" />
    <circle class="chart-sun-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(
      1,
    )}" r="30" />
    <circle class="chart-sun" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" />
  `
}

export interface ChartInput {
  /** Viewbox height; the plot stretches to fill it. */
  height: number
  path: SunSample[]
  nowFraction: number
  nowAltitude: number
  ticks: HourTick[]
  markers: ChartMarker[]
}

/** Full SVG contents for the chart, ready to drop into an `<svg>` element. */
export function renderChart(input: ChartInput): string {
  const { height } = input
  const scale = altitudeScale(input.path)
  return [
    bandMarkup(scale, height),
    axisMarkup(input.ticks, scale, height),
    pathMarkup(input.path, scale, height),
    markerMarkup(input.markers, scale, height),
    sunMarkup(input.nowFraction, input.nowAltitude, scale, height),
  ].join('')
}
