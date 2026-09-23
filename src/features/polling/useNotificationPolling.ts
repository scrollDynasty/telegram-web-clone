import { useEffect, useState } from 'react'
import { useChatStoreApi } from '@/entities/chat/context'
import { parseNotification } from '@/entities/notification/parse'
import { useSessionStore } from '@/entities/session/store'
import { useGreenApiClient } from '@/shared/api/client-context'
import { describeError, isAbortError } from '@/shared/api/errors'
import { runPollingLoop, type ConnectionStatus } from './pollingLoop'

const STANDBY_DELAY_MS = 1_000

export interface ConnectionState {
  status: ConnectionStatus
  /** Why the instance is unavailable (status `unavailable` only). */
  message?: string
}

/**
 * Runs exactly one receive/delete loop per instance and feeds parsed events into the chat store.
 * Every notification is consumed by whoever receives it, so with several tabs open only the tab
 * holding the Web Lock polls; the others follow its writes to localStorage (see
 * syncWithOtherTabs) and take over when it closes.
 */
export function useNotificationPolling(instanceId: string): ConnectionState {
  const client = useGreenApiClient()
  const chatStore = useChatStoreApi()
  const [state, setState] = useState<ConnectionState>({ status: 'connecting' })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const poll = () =>
      runPollingLoop({
        client,
        signal,
        onStatusChange: (status, error) =>
          setState({
            status,
            message: status === 'unavailable' ? describeError(error) : undefined,
          }),
        onNotification: (body) => {
          const event = parseNotification(body)
          if (event) chatStore.getState().applyEvent(event)
        },
        onFatalError: () =>
          useSessionStore
            .getState()
            .logout('GREEN-API отклонил apiTokenInstance: возможно, токен сменили. Войдите снова'),
      })

    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
    if (!locks) {
      void poll()
      return () => controller.abort()
    }

    // Still waiting after a moment: another tab polls. Its status is not shared, so no banner.
    // (Not immediately: in StrictMode the lock of the first, aborted effect is released a tick
    // later, and "connecting" must not flicker.)
    const standby = window.setTimeout(() => setState({ status: 'online' }), STANDBY_DELAY_MS)
    locks
      .request(`gac:poll:${instanceId}`, { signal }, () => {
        window.clearTimeout(standby)
        return poll()
      })
      .catch((error: unknown) => {
        if (!signal.aborted && !isAbortError(error)) console.error('Polling failed', error)
      })
    return () => {
      window.clearTimeout(standby)
      controller.abort()
    }
  }, [client, chatStore, instanceId])

  return state
}
