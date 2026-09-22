import { describe, expect, test } from 'bun:test'
import { skyColors } from './sky.js'

function channels(color: string): number[] {
  return color
    .replace(/[^0-9,]/g, '')
    .split(',')
    .map(Number)
}

function brightness(color: string): number {
  const [red, green, blue] = channels(color)
  return (red! + green! + blue!) / 3
}

describe('sky colours', () => {
  test('daytime sky is brighter than night sky', () => {
    const noon = skyColors(55, false)
    const night = skyColors(-30, false)
    expect(brightness(noon.zenith)).toBeGreaterThan(brightness(night.zenith))
    expect(brightness(noon.horizon)).toBeGreaterThan(brightness(night.horizon))
  })

  test('brightness falls off as the sun sets', () => {
    const altitudes = [30, 10, 2, -2, -8, -14, -20]
    const values = altitudes.map((altitude) =>
      brightness(skyColors(altitude, false).horizon),
    )
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]!).toBeLessThan(values[index - 1]!)
    }
  })

  test('sunset horizon is warm', () => {
    const [red, green, blue] = channels(skyColors(0, false).horizon)
    expect(red!).toBeGreaterThan(green!)
    expect(green!).toBeGreaterThan(blue!)
  })

  test('dawn and dusk differ near the horizon', () => {
    expect(skyColors(-3, true).horizon).not.toBe(skyColors(-3, false).horizon)
  })

  test('dawn and dusk agree once the sun is well up', () => {
    expect(skyColors(40, true).zenith).toBe(skyColors(40, false).zenith)
  })

  test('clamps outside the table', () => {
    expect(skyColors(90, false).zenith).toBe(skyColors(60, false).zenith)
    expect(skyColors(-90, false).zenith).toBe(skyColors(-40, false).zenith)
  })

  test('scrim is heavier under a bright sky', () => {
    expect(skyColors(50, false).scrim).toBeGreaterThan(
      skyColors(-20, false).scrim,
    )
  })
})
