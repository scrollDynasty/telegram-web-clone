import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { GreenApiClientProvider } from '@/shared/api/client-context'
import { GreenApiClient } from '@/shared/api/greenApi'
import { useMarkChatRead } from './useMarkChatRead'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100123456',
  apiTokenInstance: 'secret-token',
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <GreenApiClientProvider credentials={credentials}>{children}</GreenApiClientProvider>
)

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useMarkChatRead', () => {
  let readChat: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    readChat = vi.spyOn(GreenApiClient.prototype, 'readChat').mockResolvedValue(true)
    setVisibility('visible')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Drop the own-property override so document.visibilityState is the prototype getter again.
    delete (document as { visibilityState?: unknown }).visibilityState
  })

  it('marks the chat read once per new incoming message', () => {
    const { rerender } = renderHook(({ id }) => useMarkChatRead('100', id), {
      wrapper,
      initialProps: { id: 'm1' as string | undefined },
    })
    expect(readChat).toHaveBeenCalledTimes(1)
    expect(readChat).toHaveBeenCalledWith('100', expect.any(AbortSignal))

    rerender({ id: 'm1' })
    expect(readChat).toHaveBeenCalledTimes(1)

    rerender({ id: 'm2' })
    expect(readChat).toHaveBeenCalledTimes(2)
  })

  it('does nothing without incoming messages', () => {
    renderHook(() => useMarkChatRead('100', undefined), { wrapper })
    expect(readChat).not.toHaveBeenCalled()
  })

  it('waits for a hidden tab to become visible', () => {
    setVisibility('hidden')
    renderHook(() => useMarkChatRead('100', 'm1'), { wrapper })
    expect(readChat).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(readChat).toHaveBeenCalledTimes(1)
  })
})
