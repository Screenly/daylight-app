import './style.css'
import '@screenly/edge-apps/components'
import {
  setupErrorHandling,
  setupTheme,
  signalReady,
} from '@screenly/edge-apps'

import { LANDSCAPE_HEIGHT, PORTRAIT_HEIGHT } from './chart.js'
import { now } from './clock.js'
import { formatClock, formatLongDate } from './format.js'
import {
  applySky,
  CITY_SIZE,
  element,
  fitDynamicText,
  headlineText,
  renderPlaceHeading,
  renderChartInto,
  renderMoon,
  renderMoonPanel,
  renderStats,
  subheadText,
} from './panels.js'
import { applyPlayback, resolvePlaybackMode } from './playback.js'
import { resolvePlace, type Place } from './place.js'
import { buildSkyModel } from './view-model.js'

/**
 * Portrait when the viewport is taller than it is wide, the same test
 * <auto-scaler orientation="auto"> applies, so a square screen is laid out the
 * way it is scaled. The stylesheet keys off the attribute this sets.
 */
function isPortraitViewport(): boolean {
  const portrait = window.innerHeight > window.innerWidth
  document.documentElement.dataset.orientation = portrait
    ? 'portrait'
    : 'landscape'
  return portrait
}

function render(place: Place): void {
  const model = buildSkyModel(now(), place)

  applySky(model)
  const portrait = isPortraitViewport()
  renderPlaceHeading(place)
  element('[data-clock]').textContent = formatClock(
    model.now,
    place.locale,
    place.timeZone,
    place.hour12,
  )
  element('[data-date]').textContent = formatLongDate(
    model.now,
    place.locale,
    place.timeZone,
  )
  element('[data-headline]').textContent = headlineText(model, place)
  element('[data-subhead]').textContent = subheadText(model)

  renderChartInto(model, place, portrait ? PORTRAIT_HEIGHT : LANDSCAPE_HEIGHT)
  renderMoon(model)
  renderMoonPanel(model, place)
  renderStats(model, place)

  const headingSize = portrait ? CITY_SIZE.portrait : CITY_SIZE.landscape
  fitDynamicText(headingSize)
  requestAnimationFrame(() => fitDynamicText(headingSize))
}

/**
 * Redraw on the minute, as soon as it turns. Everything on screen is written to
 * the minute (the sun moves a quarter degree in that time), so a fixed interval
 * would only show a stale clock for part of each minute.
 */
function scheduleMinuteTicks(place: Place): void {
  const tick = (): void => {
    render(place)
    const untilNextMinute = 60000 - (Date.now() % 60000)
    window.setTimeout(tick, untilNextMinute)
  }
  window.setTimeout(tick, 60000 - (Date.now() % 60000))
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()
  setupTheme()

  try {
    const place = resolvePlace()
    const playback = resolvePlaybackMode()

    applyPlayback(place, () => render(place))

    if (playback !== 'auto_play') {
      render(place)
    }

    if (playback === 'live') {
      scheduleMinuteTicks(place)
    }

    // Orientation changes swap the layout, the chart shape and the type sizes.
    let resizeTimer: number | undefined
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => render(place), 150)
    })
  } catch (error) {
    console.error('Failed to initialize Daylight', error)
  }

  signalReady()
})
