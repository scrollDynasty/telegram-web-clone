import clsx from 'clsx'
import { RotateCw } from 'lucide-react'
import { memo, useState } from 'react'
import type { Message } from '@/entities/chat/model'
import { AnimatedStatusIcon } from '@/entities/chat/ui/AnimatedStatusIcon'
import { formatTime } from '@/shared/lib/date'
import { Linkify } from '@/shared/ui/Linkify'
import styles from './MessageBubble.module.css'

const APPENDIX_OUT =
  'M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z'
const APPENDIX_IN =
  'M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z'

/** Bubble tail of the last message in a group (Telegram's MessageAppendix). */
function Appendix({ out }: { out: boolean }) {
  return (
    <svg className={styles.appendix} width="9" height="20" aria-hidden="true">
      <path d={out ? APPENDIX_OUT : APPENDIX_IN} />
    </svg>
  )
}

interface MessageBubbleProps {
  message: Message
  /** Read out before the text: screen readers do not convey the bubble side or color. */
  author: string
  /** First/last message of a same-sender cluster: controls spacing, corners and the tail. */
  isFirst: boolean
  isLast: boolean
  onRetry: (id: string) => void
  /** A live message (not history present on mount): plays the entry animation once. */
  animateIn?: boolean
  /** Stagger for messages that arrive in one batch, ms. */
  appearanceDelay?: number
}

export const MessageBubble = memo(function MessageBubble({
  message,
  author,
  isFirst,
  isLast,
  onRetry,
  animateIn = false,
  appearanceDelay = 0,
}: MessageBubbleProps) {
  const out = message.direction === 'out'
  // Fixed at mount: a quick pending → sent re-render must not drop the class mid-animation.
  const [appear] = useState(animateIn)
  const [delay] = useState(appearanceDelay)

  return (
    <div
      className={clsx(
        styles.row,
        out ? styles.out : styles.in,
        isFirst && styles.first,
        isLast && styles.last,
        appear && (out ? styles.appearOut : styles.appearIn),
      )}
      style={appear && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className={clsx(styles.bubble, message.status === 'failed' && styles.failed)}>
        <div className={styles.text}>
          <span className="visually-hidden">{author}: </span>
          {message.media && (
            <span className={styles.media}>
              {message.media}
              {message.text && <br />}
            </span>
          )}
          <Linkify text={message.text} />
          {/* Floated meta reserves its own room at the end of the last line (Telegram trick). */}
          <span className={styles.meta}>
            <time className={styles.time} dateTime={new Date(message.timestamp).toISOString()}>
              {formatTime(message.timestamp)}
            </time>
            {out && (
              <span className={styles.status}>
                <AnimatedStatusIcon status={message.status} size={19} />
              </span>
            )}
          </span>
        </div>
        {isLast && <Appendix out={out} />}
      </div>

      {message.status === 'failed' && (
        <div className={styles.failure}>
          <span>{message.error ?? 'Не отправлено'}</span>
          <button type="button" className={styles.retry} onClick={() => onRetry(message.id)}>
            <RotateCw size={14} aria-hidden="true" /> Повторить
          </button>
        </div>
      )}
    </div>
  )
})
