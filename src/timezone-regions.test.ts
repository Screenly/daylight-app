import { describe, expect, test } from 'bun:test'
import { regionForTimeZone, ZONE_REGIONS } from './timezone-regions.js'

describe('timezone regions', () => {
  test('every entry is a whole zone name and a country code', () => {
    // The table is a hand-pasted string split on whitespace, so a zone name
    // wrapped across two lines silently becomes two junk entries.
    for (const token of ZONE_REGIONS.trim().split(/\s+/)) {
      expect(token).toMatch(/^[A-Za-z_+-]+(\/[A-Za-z0-9_+-]+)+=[A-Z]{2}$/)
    }
  })

  test('hyphenated zones are found', () => {
    expect(regionForTimeZone('America/Blanc-Sablon')).toBe('CA')
    expect(regionForTimeZone('America/Port-au-Prince')).toBe('HT')
    expect(regionForTimeZone('Sablon')).toBeUndefined()
  })
})
