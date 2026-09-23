import { flushSync } from 'react-dom'
import type { ThemePreference } from '@/entities/theme/store'
import { prefersReducedMotion } from '@/shared/lib/motion'

export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'
/** <meta name="theme-color"> values, as Telegram's switchTheme (#fff / #212121). */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#212121' }
/** Same as Telegram's useViewTransition SKIP_TIMEOUT: never leave the page frozen on a snapshot. */
const SKIP_TIMEOUT_MS = 1000
const REVEAL_DURATION_MS = 500
/* ease-in-out on purpose: the revealed area grows as r², so ease-out would flood 80% of the
 * screen in the first 100ms and then crawl to the corners. */
const REVEAL_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

export function systemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

export function subscribeSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function resolveTheme(
  preference: ThemePreference,
  system: ResolvedTheme = systemTheme(),
): ResolvedTheme {
  return preference === 'system' ? system : preference
}

/** The toggle always flips the visible theme; landing on the OS scheme goes back to following it. */
export function nextPreference(
  preference: ThemePreference,
  system: ResolvedTheme = systemTheme(),
): ThemePreference {
  const target: ResolvedTheme = resolveTheme(preference, system) === 'dark' ? 'light' : 'dark'
  return target === system ? 'system' : target
}

/** The theme currently painted, read from the document rather than the store. */
function documentTheme(): ResolvedTheme {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'light' || attr === 'dark' ? attr : systemTheme()
}

/** Sets <html data-theme> ("system" = no attribute) and the browser chrome colour. */
export function applyThemeToDocument(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    // With an explicit theme both tags get its colour; "system" restores the per-scheme values.
    const scheme: ResolvedTheme =
      preference !== 'system' ? preference : meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = THEME_COLOR[scheme]
  })
}

let running = false

/**
 * Applies `next` with a circular reveal growing from `origin` (like the night-mode switch of
 * Telegram's mobile apps), via the View Transitions API. Falls back to an instant switch when the
 * API is missing, motion is reduced, the tab is hidden, a switch is already running, or the
 * visible theme would not change. `commit` updates React state; it is flushed synchronously so
 * the `new` snapshot already contains the updated UI (icons, checked items).
 */
export function switchTheme(
  next: ThemePreference,
  origin: { x: number; y: number },
  commit: () => void,
): void {
  const apply = () => {
    applyThemeToDocument(next)
    flushSync(commit)
  }

  const visibleChange = resolveTheme(next) !== documentTheme()
  if (
    !visibleChange ||
    running ||
    typeof document.startViewTransition !== 'function' ||
    prefersReducedMotion() ||
    document.hidden
  ) {
    apply()
    return
  }

  running = true
  const root = document.documentElement
  // Disables every CSS transition until the reveal is over (see index.css).
  root.setAttribute('data-theme-switching', '')

  const { x, y } = origin
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const transition = document.startViewTransition(apply)
  const skip = window.setTimeout(() => transition.skipTransition(), SKIP_TIMEOUT_MS)

  transition.ready
    .then(() => {
      window.clearTimeout(skip)
      root.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {})

  transition.finished
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(skip)
      root.removeAttribute('data-theme-switching')
      running = false
    })
}

/** Center of the element that triggered the switch (keyboard activation has clientX = 0). */
export function originOf(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
