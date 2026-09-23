import { useState } from 'react'
import type { MessageStatus } from '../model'
import styles from './AnimatedStatusIcon.module.css'
import { MessageStatusIcon } from './MessageStatusIcon'

/**
 * MessageStatusIcon whose glyph changes (clock → tick → double tick) are revealed left to right,
 * like Telegram's MessageOutgoingStatus (Transition "reveal"). Nothing animates on mount.
 */
export function AnimatedStatusIcon({ status, size }: { status: MessageStatus; size?: number }) {
  const [prevStatus, setPrevStatus] = useState(status)
  const [changed, setChanged] = useState(false)
  if (status !== prevStatus) {
    setPrevStatus(status)
    setChanged(true)
  }

  return (
    // key: a new element per status, so the reveal restarts on every change.
    <span key={status} className={changed ? styles.reveal : styles.glyph}>
      <MessageStatusIcon status={status} size={size} />
    </span>
  )
}
