import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChatStoreProvider, useChatStoreApi } from '@/entities/chat/context'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiError } from '@/shared/api/errors'
import { GreenApiClient } from '@/shared/api/greenApi'
import { useSendMessage } from './useSendMessage'

const CHAT = '10000000'
const credentials = { apiUrl: 'https://api.test', idInstance: '4100000001', apiTokenInstance: 'x' }

function wrapper({ children }: { children: ReactNode }) {
  return (
    <GreenApiClientProvider credentials={credentials}>
      <ChatStoreProvider instanceId={credentials.idInstance}>{children}</ChatStoreProvider>
    </GreenApiClientProvider>
  )
}

function setup() {
  const { result } = renderHook(() => ({ ...useSendMessage(CHAT), store: useChatStoreApi() }), {
    wrapper,
  })
  result.current.store.getState().upsertChat({ id: CHAT })
  const messages = () => result.current.store.getState().chats[CHAT]!.messages
  return { result, messages }
}

describe('useSendMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the message at once, then reconciles it with the server id', async () => {
    let respond!: (id: string) => void
    const sendMessage = vi
      .spyOn(GreenApiClient.prototype, 'sendMessage')
      .mockImplementation(() => new Promise((resolve) => (respond = resolve)))
    const { result, messages } = setup()

    act(() => {
      expect(result.current.send('  Привет  ')).toBe(true)
    })
    expect(sendMessage).toHaveBeenCalledWith(CHAT, 'Привет')
    expect(messages()).toEqual([expect.objectContaining({ text: 'Привет', status: 'pending' })])

    await act(async () => respond('srv-1'))
    expect(messages()[0]).toMatchObject({ id: 'srv-1', status: 'sent' })
  })

  it('rejects empty and too long texts without calling the API', () => {
    const sendMessage = vi.spyOn(GreenApiClient.prototype, 'sendMessage')
    const { result, messages } = setup()
    expect(result.current.send('   ')).toBe(false)
    expect(result.current.send('x'.repeat(4097))).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
    expect(messages()).toHaveLength(0)
  })

  it('marks a failed send and retries it with the same bubble', async () => {
    const sendMessage = vi
      .spyOn(GreenApiClient.prototype, 'sendMessage')
      .mockRejectedValueOnce(new GreenApiError('network', 'down'))
      .mockResolvedValueOnce('srv-2')
    const { result, messages } = setup()

    act(() => {
      result.current.send('Привет')
    })
    await waitFor(() => expect(messages()[0]).toMatchObject({ status: 'failed' }))
    expect(messages()[0]!.error).toMatch(/Нет соединения/)

    const localId = messages()[0]!.id
    await act(async () => result.current.retry(localId))
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(messages()).toEqual([expect.objectContaining({ id: 'srv-2', localId, status: 'sent' })])
  })

  it('does not duplicate the message when the notification beats the response', async () => {
    let respond!: (id: string) => void
    vi.spyOn(GreenApiClient.prototype, 'sendMessage').mockImplementation(
      () => new Promise((resolve) => (respond = resolve)),
    )
    const { result, messages } = setup()

    act(() => {
      result.current.send('Привет')
    })
    act(() => {
      result.current.store.getState().applyEvent({
        type: 'message',
        chatId: CHAT,
        idMessage: 'srv-1',
        direction: 'out',
        text: 'Привет',
        timestamp: Date.now(),
        contact: {},
      })
    })
    await act(async () => respond('srv-1'))
    expect(messages()).toEqual([expect.objectContaining({ id: 'srv-1', status: 'sent' })])
  })

  it('still sends when the local copy cannot be stored', async () => {
    const sendMessage = vi.spyOn(GreenApiClient.prototype, 'sendMessage').mockResolvedValue('srv')
    const { result } = setup()
    vi.spyOn(result.current.store.getState(), 'addOutgoing').mockImplementation(() => {
      throw new Error('boom')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    act(() => {
      expect(result.current.send('Привет')).toBe(true)
    })
    expect(sendMessage).toHaveBeenCalledWith(CHAT, 'Привет')
  })
})
