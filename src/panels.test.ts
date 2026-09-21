import { beforeEach, describe, expect, test } from 'bun:test'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

import {
  applySky,
  placeHeading,
  headlineText,
  renderChartInto,
  renderMoon,
  renderMoonPanel,
  renderStats,
  subheadText,
  twilightName,
} from './panels.js'
import { LANDSCAPE_HEIGHT } from './chart.js'
import { buildSkyModel } from './view-model.js'

const LONDON = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZone: 'Europe/London',
  locale: 'en-GB',
  name: 'London',
}

const LONGYEARBYEN = {
  ...LONDON,
  latitude: 78.2232,
  longitude: 15.6267,
  timeZone: 'Arctic/Longyearbyen',
  name: 'Longyearbyen',
}

/** The real markup, so the tests fail if a data attribute is renamed. */
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function mountPage(): void {
  const dom = new JSDOM(template)
  globalThis.document = dom.window.document
}

function draw(place: typeof LONDON, iso: string) {
  const model = buildSkyModel(new Date(iso), place)
  applySky(model)
  renderChartInto(model, place, LANDSCAPE_HEIGHT)
  renderMoon(model)
  renderMoonPanel(model, place)
  renderStats(model, place)
  return model
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent?.trim() ?? ''
}

describe('panels', () => {
  beforeEach(mountPage)

  test('a June afternoon in London fills every region', () => {
    draw(LONDON, '2024-06-21T17:00:00Z')

    expect(document.querySelectorAll('.stat')).toHaveLength(6)
    expect(document.querySelectorAll('.moon-fact')).toHaveLength(3)
    expect(document.querySelector('[data-chart]')?.innerHTML).toContain(
      'sun-path-line',
    )
    expect(document.querySelector('[data-moon]')?.innerHTML).toContain(
      'moon-lit',
    )
    expect(text('[data-moon-phase]')).not.toBe('')
    expect(text('[data-moon-illumination]')).toContain('% lit')
  })

  test('stat tiles carry the day’s times', () => {
    draw(LONDON, '2024-06-21T17:00:00Z')

    const labels = [...document.querySelectorAll('.stat-label')].map(
      (node) => node.textContent,
    )
    expect(labels).toContain('Sunrise')
    expect(labels).toContain('Sunset')
    expect(labels).toContain('Daylight')

    const values = [...document.querySelectorAll('.stat-value')].map(
      (node) => node.textContent,
    )
    expect(values).toContain('04:43')
    expect(values).toContain('21:21')
    expect(values.join(' ')).toContain('16h 3')
  })

  test('day length is compared against yesterday', () => {
    draw(LONDON, '2024-12-28T12:00:00Z')
    const notes = [...document.querySelectorAll('.stat-note')].map(
      (node) => node.textContent,
    )
    expect(notes.some((note) => note?.includes('on yesterday'))).toBe(true)
  })
})

describe('headline and subhead', () => {
  beforeEach(mountPage)

  test('polar night reads as polar night', () => {
    const model = buildSkyModel(new Date('2024-12-21T12:00:00Z'), LONGYEARBYEN)
    expect(headlineText(model, LONGYEARBYEN)).toContain('Polar night')

    draw(LONGYEARBYEN, '2024-12-21T12:00:00Z')
    const values = [...document.querySelectorAll('.stat-value')].map(
      (node) => node.textContent,
    )
    expect(values).toContain('None')
    expect(values).toContain('—')
  })

  test('midnight sun reads as midnight sun', () => {
    const model = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONGYEARBYEN)
    expect(headlineText(model, LONGYEARBYEN)).toContain('Midnight sun')
  })

  test('the headline counts down to the next event', () => {
    const model = buildSkyModel(new Date('2024-06-21T17:00:00Z'), LONDON)
    expect(headlineText(model, LONDON)).toMatch(/^Sunset in \d+h \d+m · 21:21$/)
  })

  test('the subhead describes where the sun is', () => {
    const day = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)
    expect(subheadText(day)).toMatch(/^Sun 6\d° above the horizon, bearing S/)

    const night = buildSkyModel(new Date('2024-12-21T23:00:00Z'), LONDON)
    expect(subheadText(night)).toContain('Night')
    expect(subheadText(night)).toContain('below the horizon')
  })

  test('the headline and subhead agree at sunrise', () => {
    // One minute after the computed sunrise the sun is still below zero
    // geometrically, but it has risen.
    const model = buildSkyModel(new Date('2024-06-21T03:44:00Z'), LONDON)
    expect(headlineText(model, LONDON)).toMatch(/^Sunset in/)
    expect(subheadText(model)).toMatch(/^Sun 0° above the horizon/)
  })

  test('the sun is capitalised whether it leads or follows', () => {
    const times = [
      '2024-06-21T12:00:00Z',
      '2024-12-21T16:10:00Z',
      '2024-12-21T23:00:00Z',
    ]

    for (const time of times) {
      const text = subheadText(buildSkyModel(new Date(time), LONDON))
      expect(text).toContain('Sun ')
      expect(text).not.toContain('sun ')
    }
  })

  test('twilight names follow the standard altitudes', () => {
    expect(twilightName(5)).toBe('Daylight')
    // The sun has risen once its upper limb clears the horizon, at -0.833°.
    expect(twilightName(-0.5)).toBe('Daylight')
    expect(twilightName(-1)).toBe('Civil twilight')
    expect(twilightName(-3)).toBe('Civil twilight')
    expect(twilightName(-9)).toBe('Nautical twilight')
    expect(twilightName(-15)).toBe('Astronomical twilight')
    expect(twilightName(-30)).toBe('Night')
  })

  test('the sky variables follow the sun down', () => {
    draw(LONDON, '2024-06-21T12:00:00Z')
    const noonScrim =
      document.documentElement.style.getPropertyValue('--sky-scrim')

    mountPage()
    draw(LONDON, '2024-12-21T23:00:00Z')
    const nightScrim =
      document.documentElement.style.getPropertyValue('--sky-scrim')

    expect(Number(noonScrim)).toBeGreaterThan(Number(nightScrim))
    expect(
      document.documentElement.style.getPropertyValue('--sky-zenith'),
    ).toMatch(/^rgb\(/)
  })
})

describe('the place heading', () => {
  const located = { ...LONDON, unlocated: false }

  test('a named screen leads with its name', () => {
    expect(placeHeading({ ...located, name: 'Dubai' })).toEqual({
      heading: 'Dubai',
      meta: '51.5074° N, 0.1278° W',
    })
  })

  test('an unnamed screen leads with its coordinates', () => {
    expect(placeHeading({ ...located, name: null })).toEqual({
      heading: '51.5074° N, 0.1278° W',
      meta: null,
    })
  })

  test('a screen with no position says so', () => {
    expect(
      placeHeading({
        ...located,
        name: null,
        latitude: 0,
        longitude: 0,
        unlocated: true,
      }),
    ).toEqual({ heading: 'No location set', meta: null })
  })

  test('a name is kept when the position is missing, with the notice under it', () => {
    expect(
      placeHeading({ ...located, name: 'Lobby', unlocated: true }),
    ).toEqual({ heading: 'Lobby', meta: 'No location set' })
  })
})
