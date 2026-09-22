/**
 * Shrink a single line of text until it fits its box.
 *
 * Signage values vary in width (a clock time against a golden hour range), and
 * a wrapped value shifts everything below it. Scaling the type down instead
 * keeps every tile on the same baseline.
 */
export function fitToWidth(
  element: HTMLElement,
  maxFontSize: number,
  minFontSize: number,
): void {
  element.style.fontSize = `${maxFontSize}px`

  const available = element.clientWidth
  // No layout to measure: a zero width means the element is not on screen yet.
  if (!available || element.scrollWidth <= available) {
    return
  }

  // One proportional guess, then step down until it really fits.
  let size = Math.max(
    minFontSize,
    Math.floor((maxFontSize * available) / element.scrollWidth),
  )
  element.style.fontSize = `${size}px`

  while (size > minFontSize && element.scrollWidth > available) {
    size -= 1
    element.style.fontSize = `${size}px`
  }
}
