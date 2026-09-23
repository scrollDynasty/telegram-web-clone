import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps an element mounted while its exit animation plays (Telegram's useShowTransition).
 * `closing` is true between `open` turning false and `done()`; `done` is called from
 * onAnimationEnd, and a timeout covers the cases where that event never fires
 * (display: none, hidden tab, jsdom).
 */
export function usePresence(open: boolean, timeoutMs: number) {
  const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const timer = useRef<number | undefined>(undefined)

  // Derive "closing" during render, so the element never disappears for a frame.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setClosing(!open)
  }

  const done = useCallback(() => {
    window.clearTimeout(timer.current)
    setClosing(false)
  }, [])

  useEffect(() => {
    if (!closing) return
    timer.current = window.setTimeout(done, timeoutMs)
    return () => window.clearTimeout(timer.current)
  }, [closing, done, timeoutMs])

  return { mounted: open || closing, closing, done }
}
