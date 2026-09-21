import { describe, expect, test } from 'bun:test'
import { nextSeasonEvent } from './seasons.js'

function minutesApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60000
}

describe('season events', () => {
  test('March equinox 2024', () => {
    const event = nextSeasonEvent(new Date('2024-03-01T00:00:00Z'))
    expect(event.name).toBe('March equinox')
    expect(
      minutesApart(event.date, new Date('2024-03-20T03:06:00Z')),
    ).toBeLessThan(3)
  })

  test('June solstice 2024', () => {
    const event = nextSeasonEvent(new Date('2024-04-01T00:00:00Z'))
    expect(event.name).toBe('June solstice')
    expect(
      minutesApart(event.date, new Date('2024-06-20T20:51:00Z')),
    ).toBeLessThan(3)
  })

  test('December solstice 2025', () => {
    const event = nextSeasonEvent(new Date('2025-10-01T00:00:00Z'))
    expect(event.name).toBe('December solstice')
    expect(
      minutesApart(event.date, new Date('2025-12-21T15:03:00Z')),
    ).toBeLessThan(3)
  })

  test('rolls into the next year from late December', () => {
    const event = nextSeasonEvent(new Date('2024-12-25T00:00:00Z'))
    expect(event.name).toBe('March equinox')
    expect(event.date.getUTCFullYear()).toBe(2025)
  })
})
