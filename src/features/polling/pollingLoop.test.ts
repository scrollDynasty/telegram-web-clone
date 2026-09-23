import { GreenApiError } from '@/shared/api/errors'
import type { ReceivedNotification } from '@/shared/api/schemas'
import { backoffDelay, runPollingLoop, type ConnectionStatus } from './pollingLoop'

type Step = ReceivedNotification | null | Error

/** Fake client that replays scripted responses, then aborts the loop. */
function scriptedClient(steps: Step[], controller: AbortController) {
  const queue = [...steps]
  return {
    receiveNotification: vi.fn<
      (timeoutSec: number, signal?: AbortSignal) => Promise<ReceivedNotification | null>
    >(async () => {
      const step = queue.shift()
      if (step === undefined) {
        controller.abort()
        throw new DOMException('Aborted', 'AbortError')
      }
      if (step instanceof Error) throw step
      return step
    }),
    deleteNotification: vi.fn<(receiptId: number, signal?: AbortSignal) => Promise<boolean>>(
      async () => true,
    ),
  }
}

describe('runPollingLoop', () => {
  it('handles and then deletes every notification, skipping empty polls', async () => {
    const controller = new AbortController()
    const client = scriptedClient(
      [{ receiptId: 1, body: 'a' }, null, { receiptId: 2, body: 'b' }],
      controller,
    )
    const seen: unknown[] = []

    await runPollingLoop({ client, signal: controller.signal, onNotification: (b) => seen.push(b) })

    expect(seen).toEqual(['a', 'b'])
    expect(client.deleteNotification.mock.calls.map((c) => c[0])).toEqual([1, 2])
  })

  it('still deletes a notification when the handler throws', async () => {
    const controller = new AbortController()
    const client = scriptedClient([{ receiptId: 5, body: 'x' }], controller)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {
        throw new Error('bug')
      },
    })

    expect(client.deleteNotification).toHaveBeenCalledWith(5, controller.signal)
  })

  it('backs off on transient errors and reports connectivity', async () => {
    const controller = new AbortController()
    const client = scriptedClient(
      [new GreenApiError('network', 'down'), new GreenApiError('server', 'oops'), null],
      controller,
    )
    const sleep = vi.fn<(ms: number, signal: AbortSignal) => Promise<void>>(async () => {})
    const statuses: ConnectionStatus[] = []

    await runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {},
      onStatusChange: (s) => statuses.push(s),
      sleep,
      random: () => 1,
    })

    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
    expect(statuses).toEqual(['connecting', 'offline', 'online'])
  })

  it('reports an instance GREEN-API refuses to serve as unavailable, with the reason', async () => {
    const controller = new AbortController()
    const refused = new GreenApiError('bad_request', 'Подписка на инстанс истекла', 400)
    const client = scriptedClient([refused, refused, null], controller)
    const changes: [ConnectionStatus, string | undefined][] = []

    await runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {},
      onStatusChange: (s, error) => changes.push([s, error?.message]),
      sleep: async () => {},
    })

    // Reported once while it persists, then recovers.
    expect(changes).toEqual([
      ['connecting', undefined],
      ['unavailable', 'Подписка на инстанс истекла'],
      ['online', undefined],
    ])
  })

  it('stops on unauthorized errors', async () => {
    const controller = new AbortController()
    const client = scriptedClient(
      [new GreenApiError('unauthorized', 'bad token', 401), null],
      controller,
    )
    const onFatalError = vi.fn<(error: GreenApiError) => void>()

    await runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {},
      onFatalError,
    })

    expect(onFatalError).toHaveBeenCalledOnce()
    expect(client.receiveNotification).toHaveBeenCalledOnce()
  })
})

describe('runPollingLoop probe', () => {
  function hangingClient(controller: AbortController) {
    let release: () => void = () => {}
    return {
      release: () => release(),
      client: {
        // The long poll hangs like an empty queue does, until the test releases it.
        receiveNotification: vi.fn<
          (timeoutSec: number, signal?: AbortSignal) => Promise<ReceivedNotification | null>
        >(
          () =>
            new Promise((resolve) => {
              release = () => {
                controller.abort()
                resolve(null)
              }
            }),
        ),
        deleteNotification: vi.fn<(receiptId: number, signal?: AbortSignal) => Promise<boolean>>(
          async () => true,
        ),
      },
    }
  }

  it('reports online as soon as the probe succeeds, without waiting for the long poll', async () => {
    const controller = new AbortController()
    const { client, release } = hangingClient(controller)
    const statuses: ConnectionStatus[] = []
    const loop = runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {},
      onStatusChange: (s) => statuses.push(s),
      probe: async () => true,
    })

    await vi.waitFor(() => expect(statuses).toEqual(['connecting', 'online']))
    release()
    await loop
  })

  it('stays connecting when the probe says the instance is not ready', async () => {
    const controller = new AbortController()
    const { client, release } = hangingClient(controller)
    const statuses: ConnectionStatus[] = []
    const probe = vi.fn<(signal: AbortSignal) => Promise<boolean>>(async () => false)
    const loop = runPollingLoop({
      client,
      signal: controller.signal,
      onNotification: () => {},
      onStatusChange: (s) => statuses.push(s),
      probe,
    })

    await vi.waitFor(() => expect(probe).toHaveBeenCalled())
    await Promise.resolve()
    expect(statuses).toEqual(['connecting'])
    release()
    await loop
  })
})

describe('backoffDelay', () => {
  it('grows exponentially and is capped at 30s', () => {
    expect(backoffDelay(1, () => 1)).toBe(1000)
    expect(backoffDelay(3, () => 1)).toBe(4000)
    expect(backoffDelay(20, () => 1)).toBe(30000)
    expect(backoffDelay(3, () => 0)).toBe(2000)
  })
})
