import { useState } from 'react'
import type { MessageStatus } from '../model'
import styles from './AnimatedStatusIcon.module.css'
import { MessageStatusIcon, type TickAnimation } from './MessageStatusIcon'
import { animationFor, glyphOf, isTicks } from './statusAnimation'

/**
 * MessageStatusIcon that animates status changes the way Telegram does: clock → ✓ draws the
 * tick, ✓ → ✓✓ draws only the second tick next to the first one. Nothing animates on mount.
 */
export function AnimatedStatusIcon({ status, size }: { status: MessageStatus; size?: number }) {
  const glyph = glyphOf(status)
  const [prevGlyph, setPrevGlyph] = useState(glyph)
  const [animation, setAnimation] = useState<TickAnimation>(null)
  const [fadeIn, setFadeIn] = useState(false)
  if (glyph !== prevGlyph) {
    const next = animationFor(prevGlyph, glyph, animation)
    setPrevGlyph(glyph)
    setAnimation(next)
    // Glyphs that are not drawn (clock, failure mark) cross in with a short fade.
    setFadeIn(next === null)
  }

  return (
    // Ticks keep one element across ✓ → ✓✓ (the first tick must not restart); other glyph
    // changes remount, so their fade or draw starts over.
    <span key={isTicks(glyph) ? 'ticks' : glyph} className={fadeIn ? styles.fade : styles.glyph}>
      <MessageStatusIcon status={status} size={size} animate={animation} />
    </span>
  )
}
