import { test } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'
import tzLookup from '@photostructure/tz-lookup'
import fs from 'fs'
import path from 'path'

import { buildScenes, type City, type Scene } from './store-scenes.js'

/** Store galleries want one landscape and one portrait of each state. */
const SIZES = [
  { label: 'landscape', width: 1920, height: 1080 },
  { label: 'portrait', width: 1080, height: 1920 },
] as const

const OUTPUT_DIR = path.resolve(process.cwd(), 'store-screenshots')

/** Set STORE_SHOT_SEED to reproduce a particular set of cities. */
const seed = Number(process.env.STORE_SHOT_SEED ?? 0)

const timeZoneFor = (city: City): string =>
  tzLookup(city.latitude, city.longitude)

const scenes = buildScenes({ timeZoneFor, seed })

test.beforeAll(() => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // A record of what was shot, for captions on the store page and to reproduce
  // this gallery later.
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'scenes.json'),
    `${JSON.stringify(
      {
        seed,
        generated: new Date().toISOString(),
        scenes: scenes.map((scene, index) => ({
          order: index + 1,
          state: scene.name,
          playback: scene.playback,
          caption: scene.caption,
          city: scene.city.name,
          timeZone: scene.timeZone,
          localTime: new Intl.DateTimeFormat('en-US', {
            timeZone: scene.timeZone,
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(scene.instant),
          instant: scene.instant.toISOString(),
          files: SIZES.map(
            (size) => `${fileStem(index, scene)}-${size.label}.png`,
          ),
        })),
      },
      null,
      2,
    )}\n`,
  )
})

function fileStem(index: number, scene: Scene): string {
  return `${String(index + 1).padStart(2, '0')}-${scene.name.replaceAll('_', '-')}`
}

scenes.forEach((scene, index) => {
  for (const size of SIZES) {
    test(`@store ${scene.name} ${size.label}`, async ({ browser }) => {
      const { screenlyJsContent } = createMockScreenlyForScreenshots(
        {
          coordinates: [
            String(scene.city.latitude),
            String(scene.city.longitude),
          ] as unknown as [number, number],
          location: scene.city.name,
          screen_name: scene.city.name,
        },
        { clock_format: '12h', playback: scene.playback },
      )

      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()

      // Freeze "now" so playback moments resolve from a stable local day.
      await setupClockMock(page, scene.reference)
      await setupScreenlyJsMock(page, screenlyJsContent)

      await page.goto('/')
      await page.waitForLoadState('networkidle')
      // The heading and the stat values are fitted on the frame after layout.
      await page.waitForTimeout(300)

      await page.screenshot({
        path: path.join(
          OUTPUT_DIR,
          `${fileStem(index, scene)}-${size.label}.png`,
        ),
        fullPage: false,
      })

      await context.close()
    })
  }
})
