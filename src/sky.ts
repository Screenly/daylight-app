/**
 * Sky colours as a function of the sun's altitude.
 *
 * The screen background is the real sky over the player: deep blue at noon,
 * orange along the horizon at sunset, near black once astronomical twilight
 * ends. Dawn is given its own cooler ramp so a morning screen does not look
 * like an evening one.
 */

import { HORIZON_ALTITUDE } from './astro/index.js'

export interface SkyColors {
  /** Colour at the top of the frame. */
  zenith: string
  /** Colour along the horizon. */
  horizon: string
  /** Accent used for the sun marker and highlights. */
  glow: string
  /** Opacity of the dark scrim that keeps text readable against a bright sky. */
  scrim: number
}

interface SkyStop {
  altitude: number
  zenith: [number, number, number]
  horizon: [number, number, number]
  glow: [number, number, number]
  scrim: number
}

const DUSK_STOPS: SkyStop[] = [
  {
    altitude: 60,
    zenith: [21, 96, 180],
    horizon: [150, 205, 240],
    glow: [255, 245, 214],
    scrim: 0.26,
  },
  {
    altitude: 15,
    zenith: [33, 110, 190],
    horizon: [176, 214, 240],
    glow: [255, 233, 176],
    scrim: 0.25,
  },
  {
    altitude: 6,
    zenith: [46, 106, 175],
    horizon: [235, 197, 141],
    glow: [255, 202, 116],
    scrim: 0.23,
  },
  {
    altitude: HORIZON_ALTITUDE,
    zenith: [56, 79, 128],
    horizon: [240, 133, 63],
    glow: [255, 168, 84],
    scrim: 0.21,
  },
  {
    altitude: -4,
    zenith: [43, 62, 112],
    horizon: [220, 86, 76],
    glow: [255, 140, 96],
    scrim: 0.18,
  },
  {
    altitude: -6,
    zenith: [34, 49, 92],
    horizon: [176, 66, 95],
    glow: [231, 118, 133],
    scrim: 0.16,
  },
  {
    altitude: -12,
    zenith: [20, 29, 63],
    horizon: [74, 42, 88],
    glow: [150, 106, 168],
    scrim: 0.12,
  },
  {
    altitude: -18,
    zenith: [10, 15, 36],
    horizon: [22, 24, 58],
    glow: [116, 132, 190],
    scrim: 0.1,
  },
  {
    altitude: -40,
    zenith: [5, 7, 18],
    horizon: [11, 14, 32],
    glow: [140, 160, 210],
    scrim: 0.08,
  },
]

const DAWN_STOPS: SkyStop[] = [
  { ...DUSK_STOPS[0]! },
  { ...DUSK_STOPS[1]! },
  {
    altitude: 6,
    zenith: [46, 108, 180],
    horizon: [226, 200, 168],
    glow: [255, 214, 150],
    scrim: 0.23,
  },
  {
    altitude: HORIZON_ALTITUDE,
    zenith: [52, 82, 140],
    horizon: [236, 146, 106],
    glow: [255, 184, 130],
    scrim: 0.21,
  },
  {
    altitude: -4,
    zenith: [40, 62, 122],
    horizon: [199, 104, 116],
    glow: [244, 154, 150],
    scrim: 0.18,
  },
  {
    altitude: -6,
    zenith: [30, 48, 102],
    horizon: [140, 76, 124],
    glow: [198, 134, 168],
    scrim: 0.16,
  },
  {
    altitude: -12,
    zenith: [17, 28, 68],
    horizon: [56, 46, 96],
    glow: [130, 122, 186],
    scrim: 0.12,
  },
  { ...DUSK_STOPS[7]! },
  { ...DUSK_STOPS[8]! },
]

function mix(
  from: [number, number, number],
  to: [number, number, number],
  amount: number,
): string {
  const channel = (index: number): number =>
    Math.round(from[index]! + (to[index]! - from[index]!) * amount)
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
}

/** Sky colours for a sun altitude, in degrees. */
export function skyColors(altitude: number, rising: boolean): SkyColors {
  const stops = rising ? DAWN_STOPS : DUSK_STOPS
  const first = stops[0]!
  const last = stops[stops.length - 1]!

  if (altitude >= first.altitude) {
    return {
      zenith: mix(first.zenith, first.zenith, 0),
      horizon: mix(first.horizon, first.horizon, 0),
      glow: mix(first.glow, first.glow, 0),
      scrim: first.scrim,
    }
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const upper = stops[index]!
    const lower = stops[index + 1]!
    if (altitude <= upper.altitude && altitude >= lower.altitude) {
      const span = upper.altitude - lower.altitude
      const amount = (upper.altitude - altitude) / span
      return {
        zenith: mix(upper.zenith, lower.zenith, amount),
        horizon: mix(upper.horizon, lower.horizon, amount),
        glow: mix(upper.glow, lower.glow, amount),
        scrim: upper.scrim + (lower.scrim - upper.scrim) * amount,
      }
    }
  }

  return {
    zenith: mix(last.zenith, last.zenith, 0),
    horizon: mix(last.horizon, last.horizon, 0),
    glow: mix(last.glow, last.glow, 0),
    scrim: last.scrim,
  }
}
