/**
 * Same escaping as `escapeHtml` in `@screenly/edge-apps`, kept local so the
 * markup builders can be imported and tested outside a browser. The library's
 * entry point pulls in an error overlay that needs a DOM.
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
