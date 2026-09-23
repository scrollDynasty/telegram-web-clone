import clsx from 'clsx'
import { useEffect, useRef, useState, type RefObject, type TransitionEvent } from 'react'
import { useChatStore } from '@/entities/chat/context'
import { useSessionStore } from '@/entities/session/store'
import { useNotificationPolling } from '@/features/polling/useNotificationPolling'
import { isCoarsePointer } from '@/shared/lib/focus'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { ChatView } from '@/widgets/chat/ChatView'
import { Sidebar } from '@/widgets/sidebar/Sidebar'
import styles from './MessengerPage.module.css'

const BASE_TITLE = 'Telegram Web · GREEN-API'
/** Must match the single-pane breakpoint in MessengerPage.module.css. */
const SINGLE_PANE_QUERY = '(max-width: 767px)'

function useUnreadTitle() {
  const unread = useChatStore((s) =>
    Object.values(s.chats).reduce((sum, chat) => sum + chat.unread, 0),
  )
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE
    // Logging out (or being logged out) must not leave the counter on the login screen.
    return () => {
      document.title = BASE_TITLE
    }
  }, [unread])
}

/**
 * Closing a chat (back button, Esc) or deleting it removes the focused element with it.
 * Continue from the chat's row in the list, or from the search field if the chat is gone.
 */
function useReturnFocusToList(
  activeChatId: string | null,
  sidebarRef: RefObject<HTMLDivElement | null>,
  mainRef: RefObject<HTMLElement | null>,
) {
  const previous = useRef(activeChatId)
  useEffect(() => {
    const closedId = previous.current
    previous.current = activeChatId
    if (activeChatId || !closedId) return
    const focused = document.activeElement
    const lost = !focused || focused === document.body || mainRef.current?.contains(focused)
    if (!lost) return
    const sidebar = sidebarRef.current
    const row = sidebar?.querySelector<HTMLElement>(
      `[data-chat-id="${CSS.escape(closedId)}"] button`,
    )
    const search = isCoarsePointer()
      ? null
      : sidebar?.querySelector<HTMLElement>('input[type="search"]')
    ;(row ?? search)?.focus({ preventScroll: true })
  }, [activeChatId, sidebarRef, mainRef])
}

export function MessengerPage() {
  const instanceId = useSessionStore((s) => s.credentials?.idInstance ?? '')
  const connection = useNotificationPolling(instanceId)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const closeChat = useChatStore((s) => s.closeChat)
  const singlePane = useMediaQuery(SINGLE_PANE_QUERY)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  useUnreadTitle()
  useReturnFocusToList(activeChatId, sidebarRef, mainRef)

  // On phones the closed chat stays rendered until it has slid out, so the pane that leaves is
  // the conversation, not the "select a chat" placeholder. Two panes: switch instantly.
  const [renderedChatId, setRenderedChatId] = useState(activeChatId)
  if (activeChatId && activeChatId !== renderedChatId) setRenderedChatId(activeChatId)
  if (!activeChatId && renderedChatId && !singlePane) setRenderedChatId(null)

  function handleTransitionEnd(event: TransitionEvent<HTMLElement>) {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'transform' &&
      !activeChatId
    ) {
      setRenderedChatId(null)
    }
  }

  useEffect(() => {
    if (!activeChatId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closeChat()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeChatId, closeChat])

  return (
    <div className={clsx(styles.shell, activeChatId && styles.chatOpen)}>
      <div className={styles.wallpaper} aria-hidden="true" />
      {/* Phones: the list stays under the open chat, out of reach of focus and screen readers. */}
      <div ref={sidebarRef} className={styles.sidebar} inert={singlePane && !!activeChatId}>
        <Sidebar connection={connection} />
      </div>
      <main ref={mainRef} className={styles.main} onTransitionEnd={handleTransitionEnd}>
        <div className={clsx(styles.wallpaper, styles.mainWallpaper)} aria-hidden="true" />
        {renderedChatId ? (
          // The leaving chat is inert: no focus or clicks while it slides away.
          <div className={styles.chatSlot} inert={!activeChatId}>
            <ChatView chatId={renderedChatId} />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <span>Выберите чат или создайте новый</span>
          </div>
        )}
      </main>
    </div>
  )
}
