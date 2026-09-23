import clsx from 'clsx'
import { memo, useState } from 'react'
import { chatTitle, lastMessage, type Chat } from '@/entities/chat/model'
import { AnimatedStatusIcon } from '@/entities/chat/ui/AnimatedStatusIcon'
import { formatChatListTime } from '@/shared/lib/date'
import { formatPhone } from '@/shared/lib/phone'
import { Avatar } from '@/shared/ui/Avatar'
import { Ripple } from '@/shared/ui/Ripple'
import styles from './ChatListItem.module.css'

interface ChatListItemProps {
  chat: Chat
  active: boolean
  onSelect: (chatId: string) => void
}

export const ChatListItem = memo(function ChatListItem({
  chat,
  active,
  onSelect,
}: ChatListItemProps) {
  const title = chatTitle(chat)
  const last = lastMessage(chat)
  const subtitle = last?.text ?? (chat.phone ? formatPhone(chat.phone) : (chat.username ?? ''))

  // The unread badge stays mounted while it shrinks away, showing the last non-zero count.
  // It pops in only when it appears during the row's lifetime, not on the first render.
  const [badge, setBadge] = useState({ count: chat.unread, pop: false })
  if (chat.unread > 0 && chat.unread !== badge.count) {
    setBadge({ count: chat.unread, pop: badge.pop || badge.count === 0 })
  }
  const badgeHidden = chat.unread === 0

  return (
    <li data-chat-id={chat.id}>
      <button
        type="button"
        className={clsx(styles.item, active && styles.active)}
        onClick={() => onSelect(chat.id)}
        aria-current={active ? 'true' : undefined}
      >
        <Avatar seed={chat.id} name={title} size={54} />
        <span className={styles.body}>
          <span className={styles.row}>
            <span className={styles.title}>{title}</span>
            {last && (
              <span className={styles.meta}>
                {last.direction === 'out' && (
                  <span className={styles.status}>
                    <AnimatedStatusIcon status={last.status} size={18} />
                  </span>
                )}
                <time dateTime={new Date(last.timestamp).toISOString()}>
                  {formatChatListTime(last.timestamp)}
                </time>
              </span>
            )}
          </span>
          <span className={styles.row}>
            <span className={styles.preview}>{subtitle || 'Нет сообщений'}</span>
            {badge.count > 0 && (
              <span
                className={clsx(
                  styles.badge,
                  badge.pop && styles.badgePop,
                  badgeHidden && styles.badgeHidden,
                )}
                aria-label={badgeHidden ? undefined : `${badge.count} непрочитанных`}
                aria-hidden={badgeHidden || undefined}
                onTransitionEnd={(event) => {
                  if (badgeHidden && event.propertyName === 'transform') {
                    setBadge({ count: 0, pop: false })
                  }
                }}
              >
                {badge.count > 99 ? '99+' : badge.count}
              </span>
            )}
          </span>
        </span>
        <Ripple />
      </button>
    </li>
  )
})
