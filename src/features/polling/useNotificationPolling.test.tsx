import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChatStoreProvider, useChatStoreApi } from '@/entities/chat/context'
import { useSessionStore } from '@/entities/session/store'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiError } from '@/shared/api/errors'
import { GreenApiClient } from '@/shared/api/greenApi'
import { useNotificationPolling } from './useNotificationPolling'

const credentials = { apiUrl: 'https://api.test', idInstance: '4100000001', apiTokenInstance: 'x' }

function wrapper({ children }: { children: ReactNode }) {
  return (
    <GreenApiClientProvider credentials={credentials}>
      <ChatStoreProvider instanceId={credentials.idInstance}>{children}</ChatStoreProvider>
    </GreenApiClientProvider>
  )
}

const incoming = {
  typeWebhook: 'incomingMessageReceived',
  idMessage: 'in-1',
  timestamp: 1_700_000_000,
  senderData: { chatId: '10000001', chatType: 'user', senderName: 'Алиса' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
}

describe('useNotificationPolling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useSessionStore.setState({ credentials: null, account: null, logoutReason: null })
  })

  it('feeds parsed notifications into the chat store and deletes them', async () => {
    const deleteNotification = vi
      .spyOn(GreenApiClient.prototype, 'deleteNotification')
      .mockResolvedValue(true)
    vi.spyOn(GreenApiClient.prototype, 'receiveNotification')
      .mockResolvedValueOnce({ receiptId: 1, body: incoming })
      .mockImplementation(() => new Promise(() => {}))

    const { result, unmount } = renderHook(
      () => ({
        connection: useNotificationPolling(credentials.idInstance),
        store: useChatStoreApi(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith(1, expect.anything()))
    expect(result.current.connection.status).toBe('online')
    expect(result.current.store.getState().chats['10000001']).toMatchObject({
      name: 'Алиса',
      messages: [expect.objectContaining({ id: 'in-1', text: 'Привет' })],
    })
    unmount()
  })

  it('logs out with a reason when GREEN-API rejects the token', async () => {
    vi.spyOn(GreenApiClient.prototype, 'receiveNotification').mockRejectedValue(
      new GreenApiError('unauthorized', 'bad token', 401),
    )
    useSessionStore.setState({ credentials })

    const { unmount } = renderHook(() => useNotificationPolling(credentials.idInstance), {
      wrapper,
    })

    await waitFor(() => expect(useSessionStore.getState().credentials).toBeNull())
    expect(useSessionStore.getState().logoutReason).toMatch(/apiTokenInstance/)
    unmount()
  })

  it('reports why the instance is unavailable', async () => {
    vi.spyOn(GreenApiClient.prototype, 'receiveNotification').mockRejectedValue(
      new GreenApiError('bad_request', 'Подписка на инстанс истекла', 400),
    )
    const { result, unmount } = renderHook(() => useNotificationPolling(credentials.idInstance), {
      wrapper,
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'unavailable',
        message: 'Подписка на инстанс истекла',
      }),
    )
    unmount()
  })
})
