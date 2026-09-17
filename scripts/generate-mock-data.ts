/**
 * Writes the `mock-data.yml` the dev server reads in place of a real player.
 *
 * The screen is in San Francisco, which gives a clear seasonal swing in day
 * length and a timezone well away from UTC, so timezone mistakes show up.
 * Coordinates are strings because that is what the backend sends.
 *
 * An existing file is left alone unless `--force` is passed, so a location you
 * set while developing survives.
 */

import fs from 'fs'
import path from 'path'

const MOCK_DATA_PATH = path.resolve(process.cwd(), 'mock-data.yml')

const SAN_FRANCISCO = `---
metadata:
  coordinates:
    - '37.7749'
    - '-122.4194'
  location: San Francisco, CA
  screen_name: San Francisco
  hostname: dev-hostname
  screenly_version: development-server
  tags:
    - Development
settings:
  clock_format: 12h
`

const force = process.argv.includes('--force')

if (fs.existsSync(MOCK_DATA_PATH) && !force) {
  console.log('mock-data.yml already exists, leaving it alone (--force to replace)')
} else {
  fs.writeFileSync(MOCK_DATA_PATH, SAN_FRANCISCO)
  console.log('Wrote mock-data.yml for a San Francisco screen')
}
