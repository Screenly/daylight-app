/**
 * Development time machine: a date picker, a slider across the local day and a
 * play button, so every state the screen can reach is one drag away.
 *
 * Mounted only by the dev server. The production bundle never sees it.
 */

import './dev-panel.css'

import { formatClock, formatLongDate } from './format.js'
import type { Place } from './place.js'
import { instantFromZoned, zonedParts } from './timezone.js'
import type { SkyModel } from './view-model.js'

const MINUTES_PER_DAY = 1440
/** Minutes of sky time added per animation frame while playing. */
const PLAY_SPEED = 2

/** Remembers the collapsed state between reloads while developing. */
const COLLAPSED_KEY = 'daylight:dev-panel-collapsed'

const TEMPLATE = `
  <div class="dev-header">
    <span class="dev-title">Time machine</span>
    <button class="dev-toggle" data-dev-toggle></button>
  </div>
  <div class="dev-body" data-dev-body>
  <div class="dev-row">
    <button class="dev-button" data-dev-play title="Play through the day">
      Play
    </button>
    <button class="dev-button" data-dev-live title="Follow the real clock">
      Live
    </button>
    <input class="dev-date" type="date" data-dev-date />
    <input
      class="dev-slider"
      type="range"
      min="0"
      max="${MINUTES_PER_DAY - 1}"
      step="1"
      data-dev-slider
    />
    <span class="dev-readout" data-dev-readout></span>
  </div>
  <div class="dev-row dev-jumps" data-dev-jumps></div>
  </div>
`

export interface DevPanelOptions {
  place: Place
  /** Redraw the screen at this instant, or at the real time when null. */
  onChange: (instant: Date | null) => void
}

interface Jump {
  label: string
  instant: Date | null
}

export class DevPanel {
  private readonly root: HTMLElement
  private readonly options: DevPanelOptions
  private playing = false
  private collapsed = false
  private minutes = 0
  private day = { year: 2000, month: 1, day: 1 }

  constructor(options: DevPanelOptions) {
    this.options = options
    this.root = document.createElement('div')
    this.root.className = 'dev-panel'
    this.root.innerHTML = TEMPLATE
    document.body.appendChild(this.root)

    this.slider.addEventListener('input', () => {
      this.stop()
      this.minutes = Number(this.slider.value)
      this.emit()
    })

    this.dateInput.addEventListener('change', () => {
      const [year, month, day] = this.dateInput.value.split('-').map(Number)
      if (year && month && day) {
        this.stop()
        this.day = { year, month, day }
        this.emit()
      }
    })

    this.button('[data-dev-play]').addEventListener('click', () => {
      if (this.playing) {
        this.stop()
      } else {
        this.play()
      }
    })

    this.button('[data-dev-live]').addEventListener('click', () => {
      this.stop()
      this.options.onChange(null)
    })

    this.button('[data-dev-toggle]').addEventListener('click', () => {
      this.setCollapsed(!this.collapsed)
    })

    this.setCollapsed(readCollapsed())
  }

  private setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed
    this.root.classList.toggle('is-collapsed', collapsed)

    const toggle = this.button('[data-dev-toggle]')
    toggle.textContent = collapsed ? 'Show' : 'Hide'
    toggle.setAttribute('aria-expanded', String(!collapsed))

    writeCollapsed(collapsed)
  }

  /** Refresh the controls from the model that was just drawn. */
  update(model: SkyModel, live: boolean): void {
    const parts = zonedParts(model.now, model.observer.timeZone)
    this.day = { year: parts.year, month: parts.month, day: parts.day }
    this.minutes = parts.hour * 60 + parts.minute

    this.slider.value = String(this.minutes)
    this.dateInput.value = [
      String(parts.year).padStart(4, '0'),
      String(parts.month).padStart(2, '0'),
      String(parts.day).padStart(2, '0'),
    ].join('-')

    const { locale, timeZone, hour12 } = this.options.place
    this.readout.textContent = `${formatClock(
      model.now,
      locale,
      timeZone,
      hour12,
    )} · ${formatLongDate(model.now, locale, timeZone)}${live ? ' · live' : ''}`

    this.button('[data-dev-live]').classList.toggle('is-active', live)
    this.button('[data-dev-play]').textContent = this.playing ? 'Pause' : 'Play'
    this.renderJumps(model)
  }

  private renderJumps(model: SkyModel): void {
    const jumps: Jump[] = [
      { label: 'Dawn', instant: model.events.civilDawn },
      { label: 'Sunrise', instant: model.events.sunrise },
      { label: 'Noon', instant: model.events.solarNoon },
      { label: 'Sunset', instant: model.events.sunset },
      { label: 'Dusk', instant: model.events.civilDusk },
      { label: 'Night', instant: model.events.astronomicalDusk },
      { label: 'Full moon', instant: model.moon.nextFull },
      { label: 'New moon', instant: model.moon.nextNew },
      { label: model.season.name, instant: model.season.date },
    ]

    this.jumps.replaceChildren(
      ...jumps
        .filter(
          (jump): jump is Jump & { instant: Date } => jump.instant !== null,
        )
        .map((jump) => {
          const button = document.createElement('button')
          button.className = 'dev-button'
          button.textContent = jump.label
          button.addEventListener('click', () => {
            this.stop()
            this.options.onChange(jump.instant)
          })
          return button
        }),
    )
  }

  private play(): void {
    this.playing = true
    this.button('[data-dev-play]').textContent = 'Pause'

    const step = () => {
      if (!this.playing) {
        return
      }
      this.minutes += PLAY_SPEED
      if (this.minutes >= MINUTES_PER_DAY) {
        this.minutes -= MINUTES_PER_DAY
        this.advanceDay()
      }
      this.emit()
      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }

  private stop(): void {
    this.playing = false
    this.button('[data-dev-play]').textContent = 'Play'
  }

  private advanceDay(): void {
    const next = new Date(
      Date.UTC(this.day.year, this.day.month - 1, this.day.day + 1),
    )
    this.day = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    }
  }

  private emit(): void {
    this.options.onChange(
      instantFromZoned(
        this.day,
        Math.floor(this.minutes / 60),
        this.options.place.timeZone,
        this.minutes % 60,
      ),
    )
  }

  private get slider(): HTMLInputElement {
    return this.root.querySelector<HTMLInputElement>('[data-dev-slider]')!
  }

  private get dateInput(): HTMLInputElement {
    return this.root.querySelector<HTMLInputElement>('[data-dev-date]')!
  }

  private get readout(): HTMLElement {
    return this.root.querySelector<HTMLElement>('[data-dev-readout]')!
  }

  private get jumps(): HTMLElement {
    return this.root.querySelector<HTMLElement>('[data-dev-jumps]')!
  }

  private button(selector: string): HTMLButtonElement {
    return this.root.querySelector<HTMLButtonElement>(selector)!
  }
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  } catch {
    // Storage can be unavailable; the panel still works for this session.
  }
}

export function mountDevPanel(options: DevPanelOptions): DevPanel {
  return new DevPanel(options)
}
