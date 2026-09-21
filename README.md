# Daylight

![Screenshot](/screenshots/live-1920x1080.webp)

The sun and moon over this screen, worked out on the player itself. It needs no
API key and makes no network calls; the whole app is arithmetic on the clock and
the screen's coordinates.

Every screen configures itself. Coordinates come from the player's metadata and
the timezone from those coordinates. Deploy the same app to a fleet spread
across a dozen countries and each screen shows its own sky.

Nothing is reverse geocoded. The heading comes from the screen's own `location`
field, and a screen with no location leads with its coordinates instead.

## What it shows

The sun path chart plots the sun's altitude across the local day, with the
twilight bands drawn to scale: daylight above the horizon, then civil, nautical
and astronomical twilight below it. The marker sits where the sun is right now,
and the background gradient tracks the real colour of the sky, so the screen
looks different at seven in the morning than it does at noon.

Alongside it: sunrise, solar noon and sunset with the bearings the sun rises and
sets on, today's daylight length and how much it changed overnight, the golden
hour window, and a countdown to the next equinox or solstice.

The moon is drawn with the correct fraction of the disc lit and the crescent
tilted the way it actually hangs in the sky at this latitude, with moonrise,
moonset and the next full or new moon.

Polar screens are handled: above the Arctic and Antarctic circles the app says
midnight sun or polar night instead of inventing a sunrise.

## Getting started

Install dependencies:

```bash
bun install
```

## Development

```bash
bun run dev
```

That writes a `mock-data.yml` for a San Francisco screen if you do not have one,
which is what the dev server serves in place of a real player. Write it on its
own, or replace one you have edited, with:

```bash
bun run generate-mock-data
bun run generate-mock-data -- --force
```

Edit `mock-data.yml` to move the screen somewhere else while developing:

```yaml
metadata:
  coordinates:
    - '25.2048'
    - '55.2708'
  location: Dubai, United Arab Emirates
```

Styling uses [Tailwind CSS](https://tailwindcss.com/) utility classes, enabled via the `tailwindcss/theme.css` and `tailwindcss/utilities.css` imports in `src/style.css`. Inside `<auto-scaler>`, use `h-full`/`w-full` rather than `h-screen`/`w-screen`; see the [`@screenly/edge-apps` README](https://github.com/Screenly/edge-apps-library#styling-with-tailwind-css) for details.

## Tests

```bash
bun test src/
```

The astronomy is checked against published almanac values: sunrise and sunset to
within two minutes, lunar phases and the equinoxes and solstices to within a few
minutes of their true instants.

## Build

```bash
bun run build
```

## Deployment

Locally:

```bash
screenly edge-app create --name daylight-app --in-place
bun run deploy
screenly edge-app instance create
```

In CI, `Update Edge App` deploys `development` to stage and `main` to
production. The Edge App id is passed to the action rather than written into
`screenly.yml`, so this repository's manifest carries no `id` and there is no
`screenly_qc.yml`. Set it per environment as a repository variable,
`STAGE_EDGE_APP_ID` and `PRODUCTION_EDGE_APP_ID`, or as an `EDGE_APP_ID` secret
scoped to a GitHub environment, which takes precedence. `Initialize Edge App`
runs once by hand to create the app in an environment.

## Configuration

| Setting                | Description                                    | Required | Default               |
| ---------------------- | ---------------------------------------------- | -------- | --------------------- |
| `location_name`        | Heading text only                              | No       | Screen's own location |
| `override_coordinates` | Latitude and longitude as `51.5074, -0.1278`   | No       | Screen's own metadata |
| `override_timezone`    | IANA timezone identifier, e.g. `Europe/London` | No       | From coordinates      |
| `clock_format`         | `24h` or `12h`                                 | No       | `24h`                 |
| `playback`             | `live`, `auto_play`, or a frozen sky moment    | No       | `live`                |

The interface is English on every screen, but it writes dates the way the
screen's own region does. The timezone gives a country through the tz database's
`zone.tab`, and that country picks the English conventions: a screen in Berlin
reads "Wednesday, 16. September", one in Chicago reads "Wednesday, September 16".
An unrecognised timezone falls back to world English, which puts the day first.

`clock_format` is separate and explicit, because a region's preference is a poor
guide to what a particular screen wants: CLDR has Argentina on a 12 hour clock
though it writes 18:44. Whatever it is set to overrides the region.

`playback` controls whether the screen follows the real clock or freezes at a
named sky moment:

| Value       | What it shows                                             |
| ----------- | --------------------------------------------------------- |
| `live`      | Real clock (default)                                      |
| `auto_play` | Animates through a full local day, then keeps looping     |
| `dawn`      | Civil dawn (sun 6° below the horizon, first light)        |
| `sunrise`   | Sunrise                                                   |
| `noon`      | Solar noon                                                |
| `sunset`    | Sunset                                                    |
| `dusk`      | Civil dusk (sun 6° below the horizon, after sunset)       |
| `night`     | Astronomical dusk (sun 18° below the horizon, full night) |
| `full_moon` | Next full moon                                            |
| `new_moon`  | Next new moon                                             |
| `season`    | Next equinox or solstice                                  |

If a frozen moment does not exist for that location and day (for example
sunrise during polar night), the screen falls back to live.

A screen's `location` is free text. IP geolocation writes it as "City, Country",
but a user who picks an address in screen settings gets Google's formatted
address stored verbatim, so the first segment can be a street. Set
`location_name` on those screens.

## How it works

`src/astro/` is the astronomy, with no dependencies of its own: the NOAA solar
position algorithm, the abbreviated ELP series from Meeus chapter 47 for the
moon, and a solver for the moments the sun's longitude crosses the quarter
points of the year. It deals only in instants and coordinates.

`src/view-model.ts` turns one instant and one position into everything the
screen shows. `src/panels.ts` and `src/chart.ts` draw that, and `src/main.ts`
wires them together on a twenty second tick. Nothing below the view model
touches the DOM, which is why the whole render path is tested without a browser.

`src/place.ts` reads the screen's own metadata and settings, and
`src/timezone-regions.ts` carries the tz database's zone-to-country table that
picks the date conventions.

## Screenshots

Screenshots for San Francisco into `screenshots/` as WebP. Live mode covers
every supported player resolution as `live-{width}x{height}.webp`. Each frozen
`playback` setting is shot only at 1080p landscape and portrait
(`{mode}-1920x1080.webp` and `{mode}-1080x1920.webp`: dawn, sunrise, noon,
sunset, dusk, night, full-moon, new-moon, season). Auto play is skipped because
it is animated.

```bash
bun run screenshots
```

That runs the Playwright suite, then converts PNGs to WebP with sharp (the
standard `edge-apps-scripts screenshots` path).
