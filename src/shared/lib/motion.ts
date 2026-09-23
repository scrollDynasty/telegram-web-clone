/**
 * WAAPI and View Transitions are not covered by the CSS reduced-motion override in index.css,
 * so every JS-driven animation checks this first.
 */
export function prefersReducedMotion(): boolean {
  // Optional chaining: jsdom has no matchMedia.
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
