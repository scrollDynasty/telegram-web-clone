import { GreenApiError, isAbortError } from '@/shared/api/errors'
import type { GreenApiClient } from '@/shared/api/greenApi'

/**
 * `offline`: the network or GREEN-API is unreachable (transient).
 * `unavailable`: GREEN-API answers, but refuses to serve the instance (not authorized, starting,
 * subscription expired…): the user has to act, `error` says what happened.
 */
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'unavailable'

export interface PollingLoopOptions {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>
  signal: AbortSignal
  onNotification: (body: unknown) => void
  onStatusChange?: (status: ConnectionStatus, error?: GreenApiError) => void
  /** Called once when polling cannot continue (e.g. revoked token); the loop then stops. */
  onFatalError?: (error: GreenApiError) => void
  receiveTimeoutSec?: number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  random?: () => number
}

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

/** Exponential backoff with "full jitter" to avoid synchronized retries. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1))
  return Math.round(cap / 2 + (random() * cap) / 2)
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * GREEN-API HTTP API long-polling: receive → handle → delete, forever.
 * The notification is always deleted (even when irrelevant or when the handler throws),
 * otherwise the queue would return the same item over and over.
 */
export async function runPollingLoop({
  client,
  signal,
  onNotification,
  onStatusChange,
  onFatalError,
  receiveTimeoutSec = 20,
  sleep = abortableSleep,
  random = Math.random,
}: PollingLoopOptions): Promise<void> {
  let failures = 0
  let status: ConnectionStatus = 'connecting'
  let lastMessage: string | undefined
  const setStatus = (next: ConnectionStatus, error?: GreenApiError) => {
    if (next !== status || error?.message !== lastMessage) {
      status = next
      lastMessage = error?.message
      onStatusChange?.(next, error)
    }
  }
  onStatusChange?.(status)

  while (!signal.aborted) {
    try {
      const notification = await client.receiveNotification(receiveTimeoutSec, signal)
      failures = 0
      setStatus('online')
      if (!notification) continue

      try {
        onNotification(notification.body)
      } catch (error) {
        console.error('Failed to handle notification', error)
      }
      await client.deleteNotification(notification.receiptId, signal)
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return
      if (error instanceof GreenApiError && error.kind === 'unauthorized') {
        setStatus('offline')
        onFatalError?.(error)
        return
      }
      failures += 1
      // 400 on a parameterless long poll is about the instance itself, not the network. Keep
      // retrying (the user may fix it in the GREEN-API console), but say what is wrong.
      if (error instanceof GreenApiError && error.kind === 'bad_request') {
        setStatus('unavailable', error)
      } else {
        setStatus('offline')
      }
      try {
        await sleep(backoffDelay(failures, random), signal)
      } catch {
        return
      }
    }
  }
}
