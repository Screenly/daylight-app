import { describe, expect, test } from 'bun:test'
import { brightLimbRotation, litLimbPath } from './moon-disc.js'

describe('lit limb path', () => {
  test('full moon terminator matches the disc radius', () => {
    expect(litLimbPath(1, 100)).toContain('A 100 100 0 0 1 0 -100')
  })

  test('new moon collapses the terminator onto the centre line', () => {
    expect(litLimbPath(0, 100)).toContain('A 100 100 0 0 0 0 -100')
  })

  test('half moon draws a straight terminator', () => {
    expect(litLimbPath(0.5, 100)).toContain('A 0 100 0 0 1 0 -100')
  })

  test('gibbous and crescent bow in opposite directions', () => {
    expect(litLimbPath(0.75, 100)).toContain('0 0 1 0 -100')
    expect(litLimbPath(0.25, 100)).toContain('0 0 0 0 -100')
  })

  test('clamps out-of-range fractions', () => {
    expect(litLimbPath(1.4, 80)).toBe(litLimbPath(1, 80))
    expect(litLimbPath(-0.2, 80)).toBe(litLimbPath(0, 80))
  })
})

describe('bright limb rotation', () => {
  test('sun directly to the right leaves the limb unrotated', () => {
    const rotation = brightLimbRotation(
      { altitude: 20, azimuth: 200 },
      { altitude: 20, azimuth: 180 },
    )
    expect(rotation).toBeCloseTo(0, 5)
  })

  test('evening crescent in the west is lit from below right', () => {
    // Sun just set to the west-north-west, moon higher and further south.
    const rotation = brightLimbRotation(
      { altitude: -6, azimuth: 288 },
      { altitude: 18, azimuth: 252 },
    )
    expect(rotation).toBeGreaterThan(0)
    expect(rotation).toBeLessThan(90)
  })

  test('sun on the far side of the moon flips the limb', () => {
    const rotation = brightLimbRotation(
      { altitude: 10, azimuth: 90 },
      { altitude: 10, azimuth: 180 },
    )
    expect(Math.abs(rotation)).toBeCloseTo(180, 5)
  })

  test('sun below the moon points the limb straight down', () => {
    const rotation = brightLimbRotation(
      { altitude: -30, azimuth: 180 },
      { altitude: 30, azimuth: 180 },
    )
    expect(rotation).toBeCloseTo(90, 5)
  })
})
