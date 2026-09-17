import { describe, expect, test } from 'bun:test'
import {
  altitudeScale,
  CHART_WIDTH,
  hourTicks,
  LANDSCAPE_HEIGHT,
  renderChart,
  xForFraction,
  yForAltitude,
} from './chart.js'
import { buildSkyModel } from './view-model.js'

const LONDON = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZone: 'Europe/London',
}

describe('chart scales', () => {
  test('the altitude range covers the day and leaves headroom', () => {
    const path = [
      { fraction: 0, altitude: -18 },
      { fraction: 0.5, altitude: 40 },
      { fraction: 1, altitude: -18 },
    ]
    const scale = altitudeScale(path)
    expect(scale.top).toBeGreaterThan(40)
    expect(scale.bottom).toBeLessThan(-18)
  })

  test('a flat winter day still shows the twilight bands', () => {
    const scale = altitudeScale([{ fraction: 0.5, altitude: -4 }])
    expect(scale.top).toBe(22)
    expect(scale.bottom).toBe(-24)
  })

  test('time runs left to right across the plot area', () => {
    expect(xForFraction(0)).toBeLessThan(xForFraction(1))
    expect(xForFraction(0)).toBeGreaterThan(0)
    expect(xForFraction(1)).toBeLessThan(CHART_WIDTH)
    expect(xForFraction(0.5)).toBeCloseTo(CHART_WIDTH / 2, 5)
  })

  test('altitude runs bottom to top and clamps to the scale', () => {
    const scale = { top: 60, bottom: -30 }
    const y = (altitude: number) =>
      yForAltitude(altitude, scale, LANDSCAPE_HEIGHT)
    expect(y(60)).toBeLessThan(y(-30))
    expect(y(200)).toBe(y(60))
    expect(y(-200)).toBe(y(-30))
  })
})

describe('hour ticks', () => {
  test('a 24 hour clock gets a tick every three hours', () => {
    const ticks = hourTicks('en-GB', false)
    expect(ticks).toHaveLength(9)
    expect(ticks.map((tick) => tick.label)).toEqual([
      '00',
      '03',
      '06',
      '09',
      '12',
      '15',
      '18',
      '21',
      '00',
    ])
  })

  test('a 12 hour clock gets a tick every six hours', () => {
    expect(hourTicks('en-US', true).map((tick) => tick.label)).toEqual([
      '12 AM',
      '6 AM',
      '12 PM',
      '6 PM',
      '12 AM',
    ])
  })

  test('the clock style wins over the region default', () => {
    // en-US prefers 12 hour; a screen set to 24 hour still gets 24 hour ticks.
    expect(hourTicks('en-US', false).map((tick) => tick.label)).toEqual(
      hourTicks('en-GB', false).map((tick) => tick.label),
    )
  })

  test('drops words a region appends to the hour', () => {
    // en-DE formats an hour as "06 Uhr"; the axis only wants the number.
    expect(hourTicks('en-DE', false).map((tick) => tick.label)).toEqual(
      hourTicks('en-GB', false).map((tick) => tick.label),
    )
  })

  test('skipped hours are left off the axis', () => {
    const ticks = hourTicks('en-GB', false, (hour) =>
      hour === 3 ? null : hour / 24,
    )
    expect(ticks.map((tick) => tick.label)).not.toContain('03')
    expect(ticks).toHaveLength(8)
  })

  test('the axis closes the loop at midnight', () => {
    const ticks = hourTicks('en-US', true)
    expect(ticks[0]!.fraction).toBe(0)
    expect(ticks[ticks.length - 1]!.fraction).toBe(1)
    expect(ticks[0]!.label).toBe(ticks[ticks.length - 1]!.label)
  })
})

describe('chart markup', () => {
  const model = buildSkyModel(new Date('2024-06-21T12:00:00Z'), LONDON)
  const markup = renderChart({
    height: LANDSCAPE_HEIGHT,
    path: model.path,
    nowFraction: model.nowFraction,
    nowAltitude: model.sun.altitude,
    ticks: hourTicks('en-GB', false),
    markers: [
      { fraction: 0.2, altitude: 0, side: 'right', label: 'Sunrise 04:43' },
    ],
  })

  test('draws the path, the horizon and the sun', () => {
    expect(markup).toContain('class="sun-path-line"')
    expect(markup).toContain('class="chart-horizon"')
    expect(markup).toContain('class="chart-sun"')
  })

  test('labels events and escapes their text', () => {
    expect(markup).toContain('Sunrise 04:43')
    expect(
      renderChart({
        height: LANDSCAPE_HEIGHT,
        path: model.path,
        nowFraction: 0.5,
        nowAltitude: 10,
        ticks: [],
        markers: [
          { fraction: 0.5, altitude: 0, side: 'left', label: '<script>' },
        ],
      }),
    ).not.toContain('<script>')
  })

  test('every coordinate is a finite number', () => {
    expect(markup).not.toContain('NaN')
    expect(markup).not.toContain('Infinity')
  })
})
