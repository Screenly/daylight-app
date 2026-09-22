import { describe, expect, test } from 'bun:test'
import { moonPosition, sunPosition } from './astro/index.js'
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
  test('a sun straight below the moon points the limb straight down', () => {
    // Same azimuth, so the great circle between them is the vertical circle
    // and the bearing is exact.
    expect(
      brightLimbRotation(
        { altitude: -30, azimuth: 180 },
        { altitude: 30, azimuth: 180 },
      ),
    ).toBeCloseTo(90, 6)
  })

  test('a sun straight above the moon points the limb straight up', () => {
    expect(
      brightLimbRotation(
        { altitude: 60, azimuth: 180 },
        { altitude: 30, azimuth: 180 },
      ),
    ).toBeCloseTo(-90, 6)
  })

  test('a sun to the right points the limb right', () => {
    const rotation = brightLimbRotation(
      { altitude: 20, azimuth: 200 },
      { altitude: 20, azimuth: 180 },
    )
    // Not exactly zero: two points at equal altitude are joined by a great
    // circle that bows towards the zenith, so the limb tilts slightly up.
    expect(rotation).toBeLessThan(0)
    expect(rotation).toBeGreaterThan(-10)
  })

  test('a sun to the left points the limb left', () => {
    const rotation = brightLimbRotation(
      { altitude: 20, azimuth: 160 },
      { altitude: 20, azimuth: 180 },
    )
    expect(Math.abs(rotation)).toBeGreaterThan(170)
  })

  test('evening crescent in the west is lit from below right', () => {
    const rotation = brightLimbRotation(
      { altitude: -6, azimuth: 288 },
      { altitude: 18, azimuth: 252 },
    )
    expect(rotation).toBeGreaterThan(0)
    expect(rotation).toBeLessThan(90)
  })

  test('the southern hemisphere is handled without a special case', () => {
    // Sun above and to the left of the moon: the limb points up and left.
    const rotation = brightLimbRotation(
      { altitude: 40, azimuth: 10 },
      { altitude: 20, azimuth: 30 },
    )
    expect(rotation).toBeLessThan(-90)
  })
})

describe('the disc does not jump', () => {
  const SAN_FRANCISCO = { latitude: 37.7749, longitude: -122.4194 }

  /** Largest change in the drawn rotation between consecutive samples. */
  function largestSwing(from: Date, days: number): { swing: number; at: Date } {
    const wrap = (degrees: number) =>
      ((((degrees + 180) % 360) + 360) % 360) - 180

    let previous: number | null = null
    let worst = { swing: 0, at: from }

    for (let minute = 0; minute <= days * 24 * 60; minute += 2) {
      const at = new Date(from.getTime() + minute * 60000)
      const rotation = brightLimbRotation(
        sunPosition(at, SAN_FRANCISCO.latitude, SAN_FRANCISCO.longitude),
        moonPosition(at, SAN_FRANCISCO.latitude, SAN_FRANCISCO.longitude),
      )
      if (previous !== null) {
        const swing = Math.abs(wrap(rotation - previous))
        if (swing > worst.swing) {
          worst = { swing, at }
        }
      }
      previous = rotation
    }

    return worst
  }

  test('through the morning of a full moon, where the sky is opposite itself', () => {
    // The sun rises in the east as the full moon sets in the west, so their
    // azimuths pass through 180 degrees apart. Treating the sky as flat turned
    // the disc through 172 degrees in two minutes here.
    const worst = largestSwing(new Date('2026-09-26T12:00:00Z'), 2)
    expect(worst.swing).toBeLessThan(5)
  })

  test('across a whole lunation', () => {
    const worst = largestSwing(new Date('2026-09-01T00:00:00Z'), 30)
    expect(worst.swing).toBeLessThan(5)
  })
})
