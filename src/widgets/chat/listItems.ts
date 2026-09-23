import type { Message } from '@/entities/chat/model'
import { formatDayLabel, isSameDay } from '@/shared/lib/date'

/** Consecutive messages from the same side within this window are visually clustered. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

export interface MessageItem {
  key: string
  message: Message
  isFirst: boolean
  isLast: boolean
}

/**
 * One calendar day. Rendered as its own container, so the sticky date pill is limited to its
 * day and the next day's pill pushes it out (as in Telegram), instead of piling up.
 */
export interface DayGroup {
  key: string
  label: string
  items: MessageItem[]
}

function sameCluster(a: Message | undefined, b: Message | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.direction === b.direction &&
    Math.abs(b.timestamp - a.timestamp) < GROUP_WINDOW_MS &&
    isSameDay(a.timestamp, b.timestamp)
  )
}

/** Groups messages by day and marks cluster boundaries. */
export function buildListItems(messages: Message[], now = Date.now()): DayGroup[] {
  const groups: DayGroup[] = []
  messages.forEach((message, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    if (!prev || !isSameDay(prev.timestamp, message.timestamp)) {
      groups.push({
        // Keyed by the calendar day: an older message landing in it must not remount the group.
        key: `day-${new Date(message.timestamp).toDateString()}`,
        label: formatDayLabel(message.timestamp, now),
        items: [],
      })
    }
    groups.at(-1)!.items.push({
      key: message.localId ?? message.id,
      message,
      isFirst: !sameCluster(prev, message),
      isLast: !sameCluster(message, next),
    })
  })
  return groups
}
