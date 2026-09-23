import { formatPhone } from '@/shared/lib/phone'

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Message {
  /** GREEN-API idMessage once known, a local uuid while the message is still being sent. */
  id: string
  /** Client-side id of an optimistic message; kept after resolution as a stable React key. */
  localId?: string
  direction: 'in' | 'out'
  text: string
  /** Placeholder for a non-text message (e.g. "📷 Фото"); `text` then holds its caption, if any. */
  media?: string
  /** Unix time in milliseconds. */
  timestamp: number
  /** Meaningful for outgoing messages only. */
  status: MessageStatus
  error?: string
}

export interface Chat {
  /** Telegram chatId (numeric user id as string) — the key used to send messages. */
  id: string
  phone?: string
  name?: string
  username?: string
  messages: Message[]
  unread: number
  createdAt: number
  lastActivityAt: number
}

/** Domain events the chat store understands (produced by entities/notification/parse). */
export type ChatEvent =
  | {
      type: 'message'
      chatId: string
      idMessage: string
      direction: 'in' | 'out'
      text: string
      media?: string
      /** Unix time in milliseconds. */
      timestamp: number
      contact: { name?: string; phone?: string }
    }
  | {
      type: 'status'
      chatId: string
      idMessage: string
      status: 'delivered' | 'read' | 'failed' | 'noAccount'
      description?: string
    }

const STATUS_RANK: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

/** Status only moves forward (a late "delivered" must not override "read"); failures always win. */
export function mergeStatus(current: MessageStatus, next: MessageStatus): MessageStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current
}

export function chatTitle(chat: Pick<Chat, 'name' | 'username' | 'phone' | 'id'>): string {
  return chat.name || chat.username || (chat.phone ? formatPhone(chat.phone) : `ID ${chat.id}`)
}

export function lastMessage(chat: Chat): Message | undefined {
  return chat.messages.at(-1)
}
