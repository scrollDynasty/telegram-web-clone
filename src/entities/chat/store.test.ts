import type { ChatEvent } from './model'
import { createChatStore, MAX_MESSAGES_PER_CHAT, syncWithOtherTabs } from './store'

const CHAT = '10000000'

function incomingEvent(
  overrides: Partial<Extract<ChatEvent, { type: 'message' }>> = {},
): ChatEvent {
  return {
    type: 'message',
    chatId: CHAT,
    idMessage: 'm1',
    direction: 'in',
    text: 'hello',
    timestamp: 1_000,
    contact: { name: 'Alice', phone: '79876543210' },
    ...overrides,
  }
}

function setup() {
  let clock = 10_000
  const store = createChatStore('test', () => clock++)
  return { store, state: () => store.getState() }
}

describe('chat store', () => {
  it('creates a chat from an incoming message and counts it as unread', () => {
    const { state } = setup()
    state().applyEvent(incomingEvent())
    const chat = state().chats[CHAT]!
    expect(chat).toMatchObject({ name: 'Alice', phone: '79876543210', unread: 1 })
    expect(chat.messages).toHaveLength(1)
  })

  it('does not count messages in the open chat as unread', () => {
    const { state } = setup()
    state().upsertChat({ id: CHAT })
    state().openChat(CHAT)
    state().applyEvent(incomingEvent())
    expect(state().chats[CHAT]!.unread).toBe(0)
  })

  it('opening a chat resets unread', () => {
    const { state } = setup()
    state().applyEvent(incomingEvent())
    state().openChat(CHAT)
    expect(state().chats[CHAT]!.unread).toBe(0)
  })

  it('ignores duplicate deliveries of the same idMessage', () => {
    const { state } = setup()
    state().applyEvent(incomingEvent())
    state().applyEvent(incomingEvent())
    expect(state().chats[CHAT]!.messages).toHaveLength(1)
    expect(state().chats[CHAT]!.unread).toBe(1)
  })

  it('keeps messages ordered by timestamp', () => {
    const { state } = setup()
    state().applyEvent(incomingEvent({ idMessage: 'b', timestamp: 60_000 }))
    state().applyEvent(incomingEvent({ idMessage: 'a', timestamp: 1_000 }))
    expect(state().chats[CHAT]!.messages.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('puts a reply after our message despite second-rounded server time and clock skew', () => {
    let clock = 900
    const store = createChatStore('test', () => clock)
    const state = () => store.getState()
    state().upsertChat({ id: CHAT })
    state().addOutgoing(CHAT, 'local-1', 'Привет')
    // Server time 0 s = 0 ms, i.e. "before" our 900 ms; local clock also runs ~1 s ahead.
    clock = 1_900
    state().applyEvent(incomingEvent({ idMessage: 'reply', timestamp: 0 }))
    expect(state().chats[CHAT]!.messages.map((m) => m.id)).toEqual(['local-1', 'reply'])
  })

  describe('clock offset (PC clock differs from the server)', () => {
    function withOwnMessage() {
      let clock = 100_000
      const store = createChatStore('test', () => clock)
      const state = () => store.getState()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi') // local send time: 100 s
      return { state, tick: (ms: number) => (clock += ms) }
    }

    it('learns it from the echo that follows the sendMessage response', () => {
      const { state, tick } = withOwnMessage()
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      tick(1_000)
      // The local clock runs ~40 s ahead: the server stamped our message at 60 s.
      state().applyEvent(
        incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi', timestamp: 60_000 }),
      )
      expect(state().clockOffsetMs).toBe(39_500)
      // Our message moves to the server's time for it (what the peer's phone shows).
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ id: 'srv-1', timestamp: 60_000 })

      // A reply sent 1 s after our message lands after it, in server time.
      state().applyEvent(incomingEvent({ idMessage: 'reply', timestamp: 61_000 }))
      const messages = state().chats[CHAT]!.messages
      expect(messages.map((m) => m.id)).toEqual(['srv-1', 'reply'])
      expect(messages[1]!.timestamp).toBe(61_000)

      // The next message is stamped in server time right away.
      tick(10_000)
      state().addOutgoing(CHAT, 'local-2', 'again')
      expect(state().chats[CHAT]!.messages.at(-1)).toMatchObject({
        timestamp: 111_000 - 39_500,
        sentAt: 111_000,
      })
    })

    it('learns it when the echo adopts the pending copy', () => {
      const { state } = withOwnMessage()
      state().applyEvent(
        incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi', timestamp: 60_000 }),
      )
      expect(state().clockOffsetMs).toBe(39_500)
      expect(state().chats[CHAT]!.messages).toEqual([
        expect.objectContaining({ id: 'srv-1', localId: 'local-1', timestamp: 60_000 }),
      ])
    })

    it('appends a new own message even if its converted time is older than the last one', () => {
      const { state } = withOwnMessage()
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      // A reply stamped (server time) later than our next message's converted time.
      state().applyEvent(incomingEvent({ idMessage: 'reply', timestamp: 200_000 }))
      state().addOutgoing(CHAT, 'local-2', 'answer')
      expect(state().chats[CHAT]!.messages.map((m) => m.id)).toEqual(['srv-1', 'reply', 'local-2'])
    })

    it('a retry is a new send: it gets a fresh sentAt for the clock offset', () => {
      const { state, tick } = withOwnMessage()
      state().failOutgoing(CHAT, 'local-1', 'network')
      tick(30_000)
      state().retryOutgoing(CHAT, 'local-1')
      expect(state().chats[CHAT]!.messages[0]!.sentAt).toBe(130_000)
    })

    it('ignores the echo of an old message (not a clock reference)', () => {
      const { state, tick } = withOwnMessage()
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      tick(5 * 60_000)
      state().applyEvent(
        incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi', timestamp: 60_000 }),
      )
      expect(state().clockOffsetMs).toBe(0)
    })
  })

  it('caps stored history', () => {
    const { state } = setup()
    for (let i = 0; i < MAX_MESSAGES_PER_CHAT + 5; i++) {
      state().applyEvent(incomingEvent({ idMessage: `m${i}`, timestamp: i }))
    }
    const messages = state().chats[CHAT]!.messages
    expect(messages).toHaveLength(MAX_MESSAGES_PER_CHAT)
    expect(messages[0]!.id).toBe('m5')
  })

  describe('optimistic sending', () => {
    it('pending → sent with the server id', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ id: 'local-1', status: 'pending' })

      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({
        id: 'srv-1',
        localId: 'local-1',
        status: 'sent',
      })
    })

    it('drops the optimistic copy if the API notification arrived first', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      state().applyEvent(incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi' }))
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      expect(state().chats[CHAT]!.messages.map((m) => m.id)).toEqual(['srv-1'])
    })

    it('adopts the pending copy when the notification beats the HTTP response', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      state().applyEvent(incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi' }))
      expect(state().chats[CHAT]!.messages).toEqual([
        expect.objectContaining({ id: 'srv-1', localId: 'local-1', status: 'sent' }),
      ])
      // The late response and a late failure no longer touch it.
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      state().failOutgoing(CHAT, 'local-1', 'timeout')
      expect(state().chats[CHAT]!.messages).toEqual([
        expect.objectContaining({ id: 'srv-1', localId: 'local-1', status: 'sent' }),
      ])
    })

    it('timeout → notification: the failed bubble becomes sent instead of duplicating', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      state().failOutgoing(CHAT, 'local-1', 'GREEN-API не ответил вовремя')
      state().applyEvent(incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi' }))
      const messages = state().chats[CHAT]!.messages
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ id: 'srv-1', status: 'sent', error: undefined })
      expect(state().retryOutgoing(CHAT, 'local-1')).toBeNull()
    })

    it('reload → notification: the interrupted send is adopted, not duplicated', async () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')

      const reloaded = createChatStore('test', () => 10_500)
      await reloaded.persist.rehydrate()
      expect(reloaded.getState().chats[CHAT]!.messages[0]).toMatchObject({ status: 'failed' })

      reloaded
        .getState()
        .applyEvent(incomingEvent({ idMessage: 'srv-1', direction: 'out', text: 'hi' }))
      expect(reloaded.getState().chats[CHAT]!.messages).toEqual([
        expect.objectContaining({ id: 'srv-1', localId: 'local-1', status: 'sent' }),
      ])
    })

    it('does not revive an old failed bubble when the same text is later sent from the phone', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'ок')
      state().failOutgoing(CHAT, 'local-1', 'network')
      const nextDay = 10_000 + 24 * 60 * 60 * 1000
      state().applyEvent(
        incomingEvent({ idMessage: 'phone', direction: 'out', text: 'ок', timestamp: nextDay }),
      )
      expect(state().chats[CHAT]!.messages.map((m) => [m.id, m.status])).toEqual([
        ['local-1', 'failed'],
        ['phone', 'sent'],
      ])
    })

    it('does not adopt a different text, and prefers a pending copy over a failed one', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'ok')
      state().failOutgoing(CHAT, 'local-1', 'network')
      state().addOutgoing(CHAT, 'local-2', 'ok')
      const at = { direction: 'out' as const, timestamp: 10_000 }
      state().applyEvent(incomingEvent({ ...at, idMessage: 'phone', text: 'other' }))
      state().applyEvent(incomingEvent({ ...at, idMessage: 'srv-2', text: 'ok' }))
      expect(state().chats[CHAT]!.messages.map((m) => [m.id, m.status])).toEqual([
        ['local-1', 'failed'],
        ['srv-2', 'sent'],
        ['phone', 'sent'],
      ])
    })

    it('applies a status that arrived before the HTTP response', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      state().applyEvent({ type: 'status', chatId: CHAT, idMessage: 'srv-1', status: 'delivered' })
      state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ id: 'srv-1', status: 'delivered' })
    })

    it('fail → retry puts the message back to pending and returns its text', () => {
      const { state } = setup()
      state().upsertChat({ id: CHAT })
      state().addOutgoing(CHAT, 'local-1', 'hi')
      state().failOutgoing(CHAT, 'local-1', 'boom')
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ status: 'failed', error: 'boom' })

      expect(state().retryOutgoing(CHAT, 'local-1')).toBe('hi')
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ status: 'pending' })
      expect(state().retryOutgoing(CHAT, 'local-1')).toBeNull()
    })
  })

  describe('status notifications', () => {
    function withSent() {
      const ctx = setup()
      ctx.state().upsertChat({ id: CHAT })
      ctx.state().addOutgoing(CHAT, 'local-1', 'hi')
      ctx.state().resolveOutgoing(CHAT, 'local-1', 'srv-1')
      return ctx
    }

    it('never downgrades a status', () => {
      const { state } = withSent()
      state().applyEvent({ type: 'status', chatId: CHAT, idMessage: 'srv-1', status: 'read' })
      state().applyEvent({ type: 'status', chatId: CHAT, idMessage: 'srv-1', status: 'delivered' })
      expect(state().chats[CHAT]!.messages[0]!.status).toBe('read')
    })

    it('maps noAccount to a failed message with an explanation', () => {
      const { state } = withSent()
      state().applyEvent({ type: 'status', chatId: CHAT, idMessage: 'srv-1', status: 'noAccount' })
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ status: 'failed' })
      expect(state().chats[CHAT]!.messages[0]!.error).toMatch(/нет Telegram/)
    })
  })

  it('deleting the active chat closes it', () => {
    const { state } = setup()
    state().upsertChat({ id: CHAT })
    state().openChat(CHAT)
    state().deleteChat(CHAT)
    expect(state().chats[CHAT]).toBeUndefined()
    expect(state().activeChatId).toBeNull()
  })

  it('persists per instance and marks in-flight messages as failed on reload', async () => {
    const { state } = setup()
    state().upsertChat({ id: CHAT })
    state().addOutgoing(CHAT, 'local-1', 'hi')
    expect(localStorage.getItem('gac:chats:test')).toContain('local-1')

    const reloaded = createChatStore('test')
    await reloaded.persist.rehydrate()
    expect(reloaded.getState().chats[CHAT]!.messages[0]).toMatchObject({ status: 'failed' })
    expect(createChatStore('other').getState().chats).toEqual({})
  })

  it('keeps working in memory when localStorage is full', () => {
    const { state } = setup()
    state().upsertChat({ id: CHAT })
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => state().addOutgoing(CHAT, 'local-1', 'hi')).not.toThrow()
      expect(() => state().resolveOutgoing(CHAT, 'local-1', 'srv-1')).not.toThrow()
      expect(state().chats[CHAT]!.messages[0]).toMatchObject({ id: 'srv-1', status: 'sent' })
      expect(warn).toHaveBeenCalledOnce()
    } finally {
      setItem.mockRestore()
      warn.mockRestore()
    }
  })

  describe('several tabs', () => {
    function snapshot(chats: Record<string, unknown>) {
      return JSON.stringify({ state: { chats }, version: 1 })
    }

    it("follows another tab's writes but keeps its own in-flight sends", () => {
      const { store, state } = setup()
      const stop = syncWithOtherTabs(store, 'test')
      state().upsertChat({ id: CHAT })
      state().openChat(CHAT)
      state().addOutgoing(CHAT, 'local-1', 'mine')

      const remoteChat = {
        id: CHAT,
        messages: [
          { id: 'in-1', direction: 'in', text: 'from leader', timestamp: 5, status: 'sent' },
        ],
        unread: 1,
        createdAt: 0,
        lastActivityAt: 5,
      }
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gac:chats:test',
          newValue: snapshot({ [CHAT]: remoteChat, other: { ...remoteChat, id: 'other' } }),
        }),
      )
      stop()

      const chat = state().chats[CHAT]!
      expect(chat.messages.map((m) => m.id)).toEqual(['in-1', 'local-1'])
      // The chat is open here: nothing is unread in this tab.
      expect(chat.unread).toBe(0)
      expect(state().chats.other).toBeDefined()
    })

    it("takes the other tab's clock offset, so the tabs do not overwrite each other forever", () => {
      const { store, state } = setup()
      const stop = syncWithOtherTabs(store, 'test')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gac:chats:test',
          newValue: JSON.stringify({ state: { chats: {}, clockOffsetMs: 42_000 }, version: 1 }),
        }),
      )
      stop()
      expect(state().clockOffsetMs).toBe(42_000)
      // What this tab writes back is now identical in the offset: no new storage event loop.
      expect(JSON.parse(localStorage.getItem('gac:chats:test')!).state.clockOffsetMs).toBe(42_000)
    })

    it('closes the open chat if another tab deleted it and ignores other keys', () => {
      const { store, state } = setup()
      const stop = syncWithOtherTabs(store, 'test')
      state().upsertChat({ id: CHAT })
      state().openChat(CHAT)

      window.dispatchEvent(
        new StorageEvent('storage', { key: 'gac:chats:other', newValue: snapshot({}) }),
      )
      expect(state().activeChatId).toBe(CHAT)

      window.dispatchEvent(
        new StorageEvent('storage', { key: 'gac:chats:test', newValue: snapshot({}) }),
      )
      stop()
      expect(state().chats).toEqual({})
      expect(state().activeChatId).toBeNull()
    })
  })
})
