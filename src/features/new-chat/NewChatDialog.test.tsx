import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { ChatStoreProvider, useChatStoreApi } from '@/entities/chat/context'
import type { ChatStore } from '@/entities/chat/store'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiError } from '@/shared/api/errors'
import { GreenApiClient, type CheckAccountResult } from '@/shared/api/greenApi'
import { NewChatDialog } from './NewChatDialog'

const credentials = { apiUrl: 'https://api.test', idInstance: '4100000001', apiTokenInstance: 'x' }

function setup() {
  const captured: { store?: ChatStore } = {}
  function CaptureStore() {
    const store = useChatStoreApi()
    useEffect(() => {
      captured.store = store
    }, [store])
    return null
  }
  const onClose = vi.fn<() => void>()
  const ui = (open: boolean): ReactNode => (
    <GreenApiClientProvider credentials={credentials}>
      <ChatStoreProvider instanceId={credentials.idInstance}>
        <CaptureStore />
        <NewChatDialog open={open} onClose={onClose} />
      </ChatStoreProvider>
    </GreenApiClientProvider>
  )
  const view = render(ui(true))
  return {
    store: () => captured.store!,
    onClose,
    close: () => view.rerender(ui(false)),
    user: userEvent.setup(),
    input: () => screen.getByLabelText('Телефон или @username'),
    submit: () => screen.getByRole('button', { name: 'Создать чат' }),
  }
}

describe('NewChatDialog', () => {
  // jsdom has no modal <dialog>: a closed dialog's content is hidden from role queries.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens an existing chat without asking the API', async () => {
    const checkAccount = vi.spyOn(GreenApiClient.prototype, 'checkAccount')
    const { store, onClose, user, input, submit } = setup()
    act(() => store().getState().upsertChat({ id: '10000001', phone: '79876543210' }))

    await user.type(input(), '+7 987 654-32-10')
    await user.click(submit())

    expect(checkAccount).not.toHaveBeenCalled()
    expect(store().getState().activeChatId).toBe('10000001')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('creates and opens a chat with the resolved chatId', async () => {
    vi.spyOn(GreenApiClient.prototype, 'checkAccount').mockResolvedValue({
      exist: true,
      chatId: '20000002',
    })
    const { store, onClose, user, input, submit } = setup()

    await user.type(input(), '79001234567')
    await user.click(submit())

    expect(store().getState().chats['20000002']).toMatchObject({ phone: '79001234567' })
    expect(store().getState().activeChatId).toBe('20000002')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('explains when the number has no Telegram', async () => {
    vi.spyOn(GreenApiClient.prototype, 'checkAccount').mockResolvedValue({ exist: false })
    const { store, onClose, user, input, submit } = setup()

    await user.type(input(), '79001234567')
    await user.click(submit())

    expect(await screen.findAllByText(/нет Telegram/)).not.toHaveLength(0)
    expect(store().getState().chats).toEqual({})
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows API errors in the field', async () => {
    vi.spyOn(GreenApiClient.prototype, 'checkAccount').mockRejectedValue(
      new GreenApiError('rate_limit', 'rate_limit_exceeded'),
    )
    const { user, input, submit } = setup()

    await user.type(input(), '@alice_tg')
    await user.click(submit())

    expect(await screen.findAllByText(/Слишком много запросов/)).not.toHaveLength(0)
  })

  it('cancelling aborts the check: no chat is created or opened afterwards', async () => {
    let resolve!: (result: CheckAccountResult) => void
    let signal: AbortSignal | undefined
    vi.spyOn(GreenApiClient.prototype, 'checkAccount').mockImplementation((_target, s) => {
      signal = s
      return new Promise((r) => (resolve = r))
    })
    const { store, onClose, close, user, input, submit } = setup()

    await user.type(input(), '79001234567')
    await user.click(submit())
    close()
    expect(signal?.aborted).toBe(true)

    await act(async () => resolve({ exist: true, chatId: '30000003' }))
    expect(store().getState().chats).toEqual({})
    expect(store().getState().activeChatId).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})
