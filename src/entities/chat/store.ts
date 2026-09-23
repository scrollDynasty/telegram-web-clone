import { createJSONStorage, persist } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { safeStorage } from '@/shared/lib/safeStorage'
import { mergeStatus, type Chat, type ChatEvent, type Message, type MessageStatus } from './model'

/** Keeps localStorage bounded; older messages are dropped first. */
export const MAX_MESSAGES_PER_CHAT = 500

/**
 * Own messages carry the local clock (ms), notifications the server clock floored to whole
 * seconds. A live event this close to the newest message is treated as newer: the queue order
 * is the truth, the timestamps only disagree by rounding and clock skew.
 */
export const SERVER_CLOCK_TOLERANCE_MS = 2_000

/**
 * An outgoing notification adopts a still pending (or failed: timeout, interrupted send) local
 * copy of the same text sent within this window, instead of showing the message twice.
 */
const ADOPT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * A failed copy is adopted only if the echo arrives shortly after it (a timed-out request that
 * actually went through). Otherwise an identical text sent later from the phone would silently
 * "revive" an old failed bubble instead of appearing as a new message.
 */
const ADOPT_FAILED_WINDOW_MS = 5 * 60 * 1000

/** Status notifications that arrive before their message is known (HTTP response still pending). */
const MAX_BUFFERED_STATUSES = 50

export const chatStorageKey = (instanceId: string) => `gac:chats:${instanceId}`

export interface ChatContactInput {
  id: string
  phone?: string
  name?: string
  username?: string
}

export interface ChatState {
  chats: Record<string, Chat>
  activeChatId: string | null

  openChat: (chatId: string) => void
  closeChat: () => void
  upsertChat: (contact: ChatContactInput) => void
  deleteChat: (chatId: string) => void

  addOutgoing: (chatId: string, localId: string, text: string) => void
  resolveOutgoing: (chatId: string, localId: string, idMessage: string) => void
  failOutgoing: (chatId: string, localId: string, error: string) => void
  /** Marks a failed message as pending again and returns its text, or null if it cannot be retried. */
  retryOutgoing: (chatId: string, localId: string) => string | null

  applyEvent: (event: ChatEvent) => void
}

type PersistedChatState = Pick<ChatState, 'chats'>

function emptyChat(id: string, now: number): Chat {
  return { id, messages: [], unread: 0, createdAt: now, lastActivityAt: now }
}

/**
 * Inserts keeping chronological order; the common case (newest message) is O(1).
 * `live` events (queue order) within SERVER_CLOCK_TOLERANCE_MS of the newest message go last.
 */
function insertMessage(messages: Message[], message: Message, live = false): Message[] {
  let index = messages.length
  const newest = messages.at(-1)
  if (!live || !newest || message.timestamp + SERVER_CLOCK_TOLERANCE_MS < newest.timestamp) {
    while (index > 0 && messages[index - 1]!.timestamp > message.timestamp) index--
  }
  const next = [...messages.slice(0, index), message, ...messages.slice(index)]
  return next.length > MAX_MESSAGES_PER_CHAT ? next.slice(-MAX_MESSAGES_PER_CHAT) : next
}

function mapMessage(chat: Chat, id: string, fn: (m: Message) => Message | null): Chat {
  let changed = false
  const messages: Message[] = []
  for (const message of chat.messages) {
    if (message.id !== id) {
      messages.push(message)
      continue
    }
    changed = true
    const next = fn(message)
    if (next) messages.push(next)
  }
  return changed ? { ...chat, messages } : chat
}

type StatusEvent = Extract<ChatEvent, { type: 'status' }>
type StatusUpdate = { status: MessageStatus; error?: string }

function toStatusUpdate(event: StatusEvent): StatusUpdate {
  if (event.status === 'noAccount') {
    return {
      status: 'failed',
      error: 'У получателя нет Telegram или номер скрыт настройками приватности',
    }
  }
  if (event.status === 'failed') {
    return { status: 'failed', error: event.description ?? 'Telegram не принял сообщение' }
  }
  return { status: event.status }
}

function withStatus(message: Message, update: StatusUpdate | undefined): Message {
  if (!update) return message
  return {
    ...message,
    status: mergeStatus(message.status, update.status),
    error: update.error ?? message.error,
  }
}

/** The optimistic copy an outgoing notification belongs to: pending first, then failed. */
function findLocalCopy(messages: Message[], text: string, timestamp: number): Message | undefined {
  const candidates = messages.filter(
    (m) =>
      m.localId !== undefined &&
      m.id === m.localId &&
      m.direction === 'out' &&
      (m.status === 'pending' || m.status === 'failed') &&
      m.text === text &&
      Math.abs(m.timestamp - timestamp) <=
        (m.status === 'failed' ? ADOPT_FAILED_WINDOW_MS : ADOPT_WINDOW_MS),
  )
  return candidates.find((m) => m.status === 'pending') ?? candidates[0]
}

function mergeContact(chat: Chat, contact: Omit<ChatContactInput, 'id'>): Chat {
  return {
    ...chat,
    phone: chat.phone ?? contact.phone,
    name: contact.name ?? chat.name,
    username: contact.username ?? chat.username,
  }
}

export function createChatStore(instanceId: string, now: () => number = Date.now) {
  return createStore<ChatState>()(
    persist(
      (set, get) => {
        // In memory only: a status for an id this tab has not seen yet (Map keeps insertion order).
        const pendingStatuses = new Map<string, StatusUpdate>()
        const bufferStatus = (idMessage: string, update: StatusUpdate) => {
          const previous = pendingStatuses.get(idMessage)
          pendingStatuses.delete(idMessage)
          pendingStatuses.set(
            idMessage,
            previous
              ? {
                  status: mergeStatus(previous.status, update.status),
                  error: update.error ?? previous.error,
                }
              : update,
          )
          if (pendingStatuses.size > MAX_BUFFERED_STATUSES) {
            pendingStatuses.delete(pendingStatuses.keys().next().value!)
          }
        }
        const takeBufferedStatus = (idMessage: string) => {
          const update = pendingStatuses.get(idMessage)
          pendingStatuses.delete(idMessage)
          return update
        }

        const updateChat = (chatId: string, fn: (chat: Chat) => Chat) =>
          set((state) => {
            const chat = state.chats[chatId]
            if (!chat) return state
            const next = fn(chat)
            return next === chat ? state : { chats: { ...state.chats, [chatId]: next } }
          })

        return {
          chats: {},
          activeChatId: null,

          openChat: (chatId) =>
            set((state) => {
              const chat = state.chats[chatId]
              if (!chat) return state
              return {
                activeChatId: chatId,
                chats: chat.unread
                  ? { ...state.chats, [chatId]: { ...chat, unread: 0 } }
                  : state.chats,
              }
            }),

          closeChat: () => set({ activeChatId: null }),

          upsertChat: ({ id, ...contact }) =>
            set((state) => {
              const existing = state.chats[id] ?? emptyChat(id, now())
              return { chats: { ...state.chats, [id]: mergeContact(existing, contact) } }
            }),

          deleteChat: (chatId) =>
            set((state) => {
              const { [chatId]: _removed, ...chats } = state.chats
              return {
                chats,
                activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
              }
            }),

          addOutgoing: (chatId, localId, text) => {
            const timestamp = now()
            updateChat(chatId, (chat) => ({
              ...chat,
              lastActivityAt: timestamp,
              messages: insertMessage(chat.messages, {
                id: localId,
                localId,
                direction: 'out',
                text,
                timestamp,
                status: 'pending',
              }),
            }))
          },

          resolveOutgoing: (chatId, localId, idMessage) =>
            updateChat(chatId, (chat) => {
              // The outgoingAPIMessageReceived notification may have beaten the HTTP response
              // (then applyEvent has already adopted this copy, or it is a separate server copy).
              const alreadyKnown = chat.messages.some((m) => m.id === idMessage)
              const buffered = takeBufferedStatus(idMessage)
              return mapMessage(chat, localId, (m) =>
                alreadyKnown
                  ? null
                  : withStatus({ ...m, id: idMessage, status: 'sent', error: undefined }, buffered),
              )
            }),

          failOutgoing: (chatId, localId, error) =>
            updateChat(chatId, (chat) =>
              mapMessage(chat, localId, (m) => ({ ...m, status: 'failed', error })),
            ),

          retryOutgoing: (chatId, localId) => {
            const message = get().chats[chatId]?.messages.find((m) => m.id === localId)
            if (!message || message.status !== 'failed' || message.direction !== 'out') return null
            updateChat(chatId, (chat) =>
              mapMessage(chat, localId, (m) => ({ ...m, status: 'pending', error: undefined })),
            )
            return message.text
          },

          applyEvent: (event) => {
            if (event.type === 'status') {
              const update = toStatusUpdate(event)
              const known = get().chats[event.chatId]?.messages.some(
                (m) => m.id === event.idMessage,
              )
              // The status can outrun the sendMessage response: keep it until the id is known.
              if (!known) bufferStatus(event.idMessage, update)
              else {
                updateChat(event.chatId, (chat) =>
                  mapMessage(chat, event.idMessage, (m) => withStatus(m, update)),
                )
              }
              return
            }

            set((state) => {
              const existing = state.chats[event.chatId] ?? emptyChat(event.chatId, now())
              // Duplicate delivery (e.g. deleteNotification failed and the queue replayed it).
              if (existing.messages.some((m) => m.id === event.idMessage)) return state

              const withContact = mergeContact(existing, event.contact)
              const buffered = takeBufferedStatus(event.idMessage)

              // Our own message sent from this app: the optimistic copy becomes the server one
              // (the HTTP response is late, timed out, or the tab was reloaded meanwhile).
              const local =
                event.direction === 'out'
                  ? findLocalCopy(withContact.messages, event.text, event.timestamp)
                  : undefined
              if (local) {
                const adopted = mapMessage(withContact, local.id, (m) =>
                  withStatus(
                    { ...m, id: event.idMessage, status: 'sent', error: undefined },
                    buffered,
                  ),
                )
                return { chats: { ...state.chats, [event.chatId]: adopted } }
              }

              const isUnread = event.direction === 'in' && state.activeChatId !== event.chatId
              const chat: Chat = {
                ...withContact,
                unread: isUnread ? withContact.unread + 1 : withContact.unread,
                lastActivityAt: Math.max(withContact.lastActivityAt, event.timestamp),
                messages: insertMessage(
                  withContact.messages,
                  withStatus(
                    {
                      id: event.idMessage,
                      direction: event.direction,
                      text: event.text,
                      timestamp: event.timestamp,
                      status: 'sent',
                    },
                    buffered,
                  ),
                  true,
                ),
              }
              return { chats: { ...state.chats, [event.chatId]: chat } }
            })
          },
        }
      },
      {
        name: chatStorageKey(instanceId),
        version: 1,
        storage: createJSONStorage(() => safeStorage(() => localStorage)),
        partialize: (state): PersistedChatState => ({ chats: state.chats }),
        // Messages that were in flight when the tab closed will never resolve.
        merge: (persisted, current) => {
          const chats = (persisted as PersistedChatState | undefined)?.chats ?? {}
          const fixed = Object.fromEntries(
            Object.entries(chats).map(([id, chat]) => [
              id,
              {
                ...chat,
                messages: chat.messages.map((m) =>
                  m.status === 'pending'
                    ? { ...m, status: 'failed' as const, error: 'Отправка была прервана' }
                    : m,
                ),
              },
            ]),
          )
          return { ...current, chats: fixed }
        },
      },
    ),
  )
}

export type ChatStore = ReturnType<typeof createChatStore>

const messageKey = (m: Message) => m.localId ?? m.id

/** True when `mine` is further along than `theirs` (resolved to a server id, or a newer status). */
function isAhead(mine: Message, theirs: Message): boolean {
  if (theirs.id === theirs.localId && mine.id !== mine.localId) return true
  return mine.status !== theirs.status && mergeStatus(theirs.status, mine.status) === mine.status
}

/**
 * Another tab's snapshot wins (it is the one polling the queue), except for what only this tab
 * knows: its in-flight sends and outcomes it has already received.
 */
export function mergeRemoteChats(
  local: Record<string, Chat>,
  remote: Record<string, Chat>,
  activeChatId: string | null,
): Record<string, Chat> {
  return Object.fromEntries(
    Object.entries(remote).map(([id, remoteChat]) => {
      let chat = remoteChat
      const localChat = local[id]
      if (localChat) {
        const mine = new Map(localChat.messages.map((m) => [messageKey(m), m]))
        const theirs = new Set(remoteChat.messages.map(messageKey))
        let messages = remoteChat.messages.map((m) => {
          const own = m.localId ? mine.get(m.localId) : undefined
          return own && isAhead(own, m) ? own : m
        })
        for (const m of localChat.messages) {
          if (m.localId && m.status === 'pending' && !theirs.has(m.localId)) {
            messages = insertMessage(messages, m)
          }
        }
        chat = { ...remoteChat, messages }
      }
      if (id === activeChatId && chat.unread) chat = { ...chat, unread: 0 }
      return [id, chat]
    }),
  )
}

/**
 * Keeps this tab in sync with other tabs of the same instance: only one of them polls the
 * notification queue (see useNotificationPolling), the others follow its writes.
 * Returns an unsubscribe function.
 */
export function syncWithOtherTabs(store: ChatStore, instanceId: string): () => void {
  const key = chatStorageKey(instanceId)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key || !event.newValue) return
    let remote: Record<string, Chat> | undefined
    try {
      remote = (JSON.parse(event.newValue) as { state?: PersistedChatState }).state?.chats
    } catch {
      return
    }
    if (!remote) return
    const { chats, activeChatId } = store.getState()
    const next = mergeRemoteChats(chats, remote, activeChatId)
    store.setState({
      chats: next,
      // The open chat may have been deleted in the other tab.
      activeChatId: activeChatId && next[activeChatId] ? activeChatId : null,
    })
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
