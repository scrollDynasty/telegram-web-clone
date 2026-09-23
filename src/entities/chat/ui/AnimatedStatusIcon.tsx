import { useState } from 'react'
import type { MessageStatus } from '../model'
import styles from './AnimatedStatusIcon.module.css'
import { MessageStatusIcon } from './MessageStatusIcon'

/** `sent` and `delivered` share the single-tick glyph: switching between them is not a change. */
function glyphOf(status: MessageStatus): string {
  return status === 'delivered' ? 'sent' : status
}

/**
 * MessageStatusIcon whose glyph changes (clock → tick → double tick) are revealed left to right,
 * like Telegram's MessageOutgoingStatus (Transition "reveal"). Nothing animates on mount.
 */
export function AnimatedStatusIcon({ status, size }: { status: MessageStatus; size?: number }) {
  const glyph = glyphOf(status)
  const [prevGlyph, setPrevGlyph] = useState(glyph)
  const [changed, setChanged] = useState(false)
  if (glyph !== prevGlyph) {
    setPrevGlyph(glyph)
    setChanged(true)
  }

  return (
    // key: a new element per glyph, so the reveal restarts on every visible change.
    <span key={glyph} className={changed ? styles.reveal : styles.glyph}>
      <MessageStatusIcon status={status} size={size} />
    </span>
  )
}
