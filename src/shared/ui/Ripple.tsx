import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/shared/lib/motion'
import styles from './Ripple.module.css'

/** Slightly longer than the 700ms wave: removes it even if animationend never fires. */
const WAVE_LIFETIME_MS = 800

interface RippleProps {
  /** Round controls (icon buttons, FAB): the wave grows from the center and covers the circle. */
  centered?: boolean
}

function isDisabled(el: HTMLElement): boolean {
  return (
    (el instanceof HTMLButtonElement && el.disabled) || el.getAttribute('aria-disabled') === 'true'
  )
}

/**
 * Material-style ink ripple (as Telegram's RippleEffect). Place it as the last child of a
 * positioned element: it listens to the parent's pointerdown and draws waves imperatively,
 * so pressing never re-renders React.
 */
export function Ripple({ centered = false }: RippleProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = ref.current
    const parent = container?.parentElement
    if (!container || !parent) return

    const onPointerDown = (event: PointerEvent) => {
      // Reduced motion hides the container (display: none), where animationend never fires.
      if (event.button !== 0 || isDisabled(parent) || prefersReducedMotion()) return
      const rect = parent.getBoundingClientRect()
      const size = centered ? parent.offsetWidth : parent.offsetWidth / 2
      const x = centered ? (rect.width - size) / 2 : event.clientX - rect.left - size / 2
      const y = centered ? (rect.height - size) / 2 : event.clientY - rect.top - size / 2

      const wave = document.createElement('span')
      wave.className = styles.wave!
      wave.style.width = wave.style.height = `${size}px`
      wave.style.left = `${x}px`
      wave.style.top = `${y}px`
      const timer = window.setTimeout(() => wave.remove(), WAVE_LIFETIME_MS)
      wave.addEventListener(
        'animationend',
        () => {
          window.clearTimeout(timer)
          wave.remove()
        },
        { once: true },
      )
      container.appendChild(wave)
    }

    parent.addEventListener('pointerdown', onPointerDown)
    return () => parent.removeEventListener('pointerdown', onPointerDown)
  }, [centered])

  return <span ref={ref} className={styles.container} aria-hidden="true" />
}
