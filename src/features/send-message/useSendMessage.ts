import { useCallback } from 'react'
import { useChatStoreApi } from '@/entities/chat/context'
import type { ChatStore } from '@/entities/chat/store'
import { useGreenApiClient } from '@/shared/api/client-context'
import { describeError } from '@/shared/api/errors'

export const MAX_MESSAGE_LENGTH = 4096

function addLocalCopy(store: ChatStore, chatId: string, localId: string, text: string) {
  try {
    store.getState().addOutgoing(chatId, localId, text)
  } catch (error) {
    console.error('Failed to add the optimistic message', error)
  }
}

/** Optimistic send: the bubble appears immediately and is reconciled with the API response. */
export function useSendMessage(chatId: string) {
  const client = useGreenApiClient()
  const store = useChatStoreApi()

  const deliver = useCallback(
    async (localId: string, text: string) => {
      try {
        const idMessage = await client.sendMessage(chatId, text)
        store.getState().resolveOutgoing(chatId, localId, idMessage)
      } catch (error) {
        store.getState().failOutgoing(chatId, localId, describeError(error))
      }
    },
    [client, store, chatId],
  )

  const send = useCallback(
    (rawText: string) => {
      const text = rawText.trim()
      if (!text || text.length > MAX_MESSAGE_LENGTH) return false
      const localId = `local-${crypto.randomUUID()}`
      // Whatever happens to the local bubble, the message itself must still be sent.
      addLocalCopy(store, chatId, localId, text)
      void deliver(localId, text)
      return true
    },
    [store, chatId, deliver],
  )

  const retry = useCallback(
    (localId: string) => {
      const text = store.getState().retryOutgoing(chatId, localId)
      if (text !== null) void deliver(localId, text)
    },
    [store, chatId, deliver],
  )

  return { send, retry }
}
