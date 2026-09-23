import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Message } from '@/entities/chat/model'
import { IconButton } from '@/shared/ui/IconButton'
import { buildListItems } from './listItems'
import { MessageBubble } from './MessageBubble'
import styles from './MessageList.module.css'

const STICK_THRESHOLD_PX = 120
/** More new keys than this in one render is a history sync, not live messages: no animation. */
const MAX_ANIMATED_BATCH = 20
/** Stagger between messages arriving in one batch (Telegram's MESSAGE_APPEARANCE_DELAY). */
const APPEARANCE_DELAY_MS = 10

const messageKey = (message: Message) => message.localId ?? message.id

interface MessageListProps {
  messages: Message[]
  /** The other side's name, announced as the author of incoming messages. */
  peerName: string
  onRetry: (id: string) => void
}

/** Render with `key={chatId}` so scroll state resets when switching chats. */
export function MessageList({ messages, peerName, onRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const groups = useMemo(() => buildListItems(messages), [messages])

  // History present on mount never animates (as in Telegram, only the live tail does); the list
  // is keyed by chat, so switching chats starts over. `fresh` = keys added by the last update.
  const [initialKeys] = useState(() => new Set(messages.map(messageKey)))
  const [tracked, setTracked] = useState({ messages, fresh: [] as string[] })
  if (tracked.messages !== messages) {
    const before = new Set(tracked.messages.map(messageKey))
    setTracked({ messages, fresh: messages.map(messageKey).filter((key) => !before.has(key)) })
  }
  const animateFresh = tracked.fresh.length <= MAX_ANIMATED_BATCH
  const lastMessage = messages.at(-1)
  // Stable across optimistic → server id resolution, so it changes only when a new message lands.
  const lastKey = lastMessage ? (lastMessage.localId ?? lastMessage.id) : null
  const lastIsOwn = lastMessage?.direction === 'out'

  // Keep the view pinned to the newest message unless the user scrolled up to read history.
  // Own outgoing messages always scroll into view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || lastKey === null) return
    if (stickToBottom.current || lastIsOwn) el.scrollTop = el.scrollHeight
  }, [lastKey, lastIsOwn])

  // Content can also grow without a new message: a failed send adds the "retry" pill, the
  // composer grows and raises the bottom inset. Stay pinned while the user is at the bottom,
  // otherwise that content ends up hidden under the floating composer.
  const keepPinned = useCallback((column: HTMLDivElement | null) => {
    if (!column || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const el = scrollRef.current
      if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(column)
    return () => observer.disconnect()
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.current = distance < STICK_THRESHOLD_PX
    setShowJump(distance > STICK_THRESHOLD_PX * 3)
  }

  function jumpToBottom() {
    const el = scrollRef.current
    if (!el) return
    // The button turns inert once hidden; keep keyboard focus in the conversation, not on <body>.
    el.focus({ preventScroll: true })
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={scrollRef}
        className={styles.scroller}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="История сообщений"
        // Scrollable region must be reachable from the keyboard.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyCard}>
              <span className={styles.emptySticker} aria-hidden="true">
                👋
              </span>
              <p className={styles.emptyTitle}>Сообщений пока нет</p>
              <p>Напишите первым, и сообщение уйдёт собеседнику в Telegram</p>
            </div>
          </div>
        ) : (
          <div ref={keepPinned} className={styles.column}>
            {groups.map((group) => (
              <section key={group.key} className={styles.dayGroup}>
                <div className={styles.day}>
                  <span>{group.label}</span>
                </div>
                {group.items.map((item) => (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    author={item.message.direction === 'out' ? 'Вы' : peerName}
                    isFirst={item.isFirst}
                    isLast={item.isLast}
                    onRetry={onRetry}
                    animateIn={animateFresh && !initialKeys.has(item.key)}
                    appearanceDelay={
                      Math.max(0, tracked.fresh.indexOf(item.key)) * APPEARANCE_DELAY_MS
                    }
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Always mounted so it can slide both ways; inert keeps it out of reach while hidden. */}
      <IconButton
        label="К последним сообщениям"
        className={clsx(styles.jump, showJump && styles.revealed)}
        onClick={jumpToBottom}
        inert={!showJump}
        aria-hidden={!showJump}
      >
        <ChevronDown size={28} />
      </IconButton>
    </div>
  )
}
