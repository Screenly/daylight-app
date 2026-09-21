import { test } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  getScreenshotsDir,
  RESOLUTIONS,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'
import tzLookup from '@photostructure/tz-lookup'
import path from 'path'

import { buildScenes, SAN_FRANCISCO, type City } from './playback-scenes.js'

const timeZoneFor = (city: City): string =>
  tzLookup(city.latitude, city.longitude)

const scenes = buildScenes({ timeZoneFor })

const sfMetadata = {
  coordinates: [
    String(SAN_FRANCISCO.latitude),
    String(SAN_FRANCISCO.longitude),
  ] as unknown as [number, number],
  location: SAN_FRANCISCO.name,
  screen_name: 'San Francisco',
}

const { screenlyJsContent: liveJsContent } = createMockScreenlyForScreenshots(
  sfMetadata,
  {
    clock_format: '12h',
    location_name: 'San Francisco',
    playback: 'live',
  },
)

for (const { width, height } of RESOLUTIONS) {
  test(`screenshot live ${width}x${height}`, async ({ browser }) => {
    const screenshotsDir = getScreenshotsDir()
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()

    await setupClockMock(page)
    await setupScreenlyJsMock(page, liveJsContent)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    await page.screenshot({
      path: path.join(screenshotsDir, `${width}x${height}.png`),
      fullPage: false,
    })

    await context.close()
  })
}

for (const scene of scenes) {
  const { screenlyJsContent } = createMockScreenlyForScreenshots(sfMetadata, {
    clock_format: '12h',
    location_name: 'San Francisco',
    playback: scene.playback,
  })

  const fileStem = scene.name.replaceAll('_', '-')

  for (const { width, height } of RESOLUTIONS) {
    test(`screenshot ${scene.name} ${width}x${height}`, async ({ browser }) => {
      const screenshotsDir = getScreenshotsDir()
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()

      await setupClockMock(page, scene.reference)
      await setupScreenlyJsMock(page, screenlyJsContent)

      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)

      await page.screenshot({
        path: path.join(screenshotsDir, `${fileStem}-${width}x${height}.png`),
        fullPage: false,
      })

      await context.close()
    })
  }
}
