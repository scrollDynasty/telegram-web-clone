import clsx from 'clsx'
import type { MessageStatus } from '../model'
import styles from './MessageStatusIcon.module.css'

const LABELS: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
}

/**
 * Both ticks share one geometry, so going from ✓ to ✓✓ only adds the second tick: the first
 * one never moves. The second tick's short stroke tucks under the first one, as in Telegram.
 */
const FIRST_TICK = 'M2.5 12.6 6.7 16.8 15.6 7.6'
const SECOND_TICK = 'M11.4 16.1 12.1 16.8 21 7.6'

/**
 * first: clock → ✓ (or ✓✓: the second tick follows after a delay);
 * second: ✓ → ✓✓; first+second: ✓✓ arrived while the first tick was still being drawn.
 */
export type TickAnimation = 'first' | 'second' | 'first+second' | null

interface MessageStatusIconProps {
  status: MessageStatus
  size?: number
  /** Draws the newly appeared tick (clock → ✓, or ✓ → ✓✓). */
  animate?: TickAnimation
}

/** Telegram-like status glyphs; the color comes from `currentColor` of the context. */
export function MessageStatusIcon({ status, size = 19, animate = null }: MessageStatusIconProps) {
  const common = {
    role: 'img' as const,
    'aria-label': LABELS[status],
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: styles.icon,
  }

  switch (status) {
    case 'pending':
      return (
        <svg {...common} strokeWidth={1.8}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8v4l2.6 1.7" />
        </svg>
      )
    // Telegram has no separate "delivered" mark: one tick until the peer reads it, then two.
    // GREEN-API's `delivered` (reached the recipient) is therefore still a single tick.
    case 'sent':
    case 'delivered':
    case 'read':
      return (
        <svg {...common} strokeWidth={1.7}>
          <path
            d={FIRST_TICK}
            pathLength={1}
            className={clsx((animate === 'first' || animate === 'first+second') && styles.draw)}
          />
          {status === 'read' && (
            <path
              d={SECOND_TICK}
              pathLength={1}
              className={clsx(animate && styles.draw, animate === 'first' && styles.delayed)}
            />
          )}
        </svg>
      )
    case 'failed':
      return (
        <svg {...common} stroke="none">
          <circle cx="12" cy="12" r="8" fill="var(--danger)" />
          <path d="M12 7.8v4.9M12 16.2v.01" stroke="#fff" strokeWidth={2.2} />
        </svg>
      )
  }
}
