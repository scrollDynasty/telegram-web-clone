import { useEffect, useRef } from 'react'
import { useGreenApiClient } from '@/shared/api/client-context'

/**
 * Like Telegram, a message counts as read once its chat is on screen: while the chat is open
 * and the tab is visible, every new incoming message marks the chat read (ReadChat), so the
 * peer sees ✓✓. A hidden tab waits until the user comes back.
 */
export function useMarkChatRead(chatId: string, lastIncomingId: string | undefined) {
  const client = useGreenApiClient()
  const readUpTo = useRef<string | null>(null)

  useEffect(() => {
    if (!lastIncomingId) return
    const controller = new AbortController()

    const markIfVisible = () => {
      if (document.visibilityState !== 'visible' || readUpTo.current === lastIncomingId) return
      readUpTo.current = lastIncomingId
      client.readChat(chatId, controller.signal).catch(() => {
        // Best effort: the next message or the next visit retries.
        if (readUpTo.current === lastIncomingId) readUpTo.current = null
      })
    }

    markIfVisible()
    document.addEventListener('visibilitychange', markIfVisible)
    return () => {
      document.removeEventListener('visibilitychange', markIfVisible)
      controller.abort()
    }
  }, [client, chatId, lastIncomingId])
}
