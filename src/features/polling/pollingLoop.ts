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
  /**
   * Quick liveness check run alongside the long poll while not yet online. An empty queue makes
   * receiveNotification answer only after `receiveTimeoutSec`, so without it the UI would say
   * "connecting" for that long. Resolves true when the instance is reachable and authorized.
   */
  probe?: (signal: AbortSignal) => Promise<boolean>
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
  probe,
  sleep = abortableSleep,
  random = Math.random,
}: PollingLoopOptions): Promise<void> {
  let probing = false
  // Bumped on every failed poll: a probe that started before a failure must not undo it.
  let failureSeq = 0
  // Only a lost connection (network, timeout) can be ruled out by a successful probe. A 429 or
  // 5xx from the queue itself says nothing about getAccountSettings, and vice versa.
  let connectivityLost = false
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
    // Not after `unavailable` or a server-side failure: the instance answers but the queue does
    // not work, a successful probe would make the status flap.
    const canProbe = status === 'connecting' || (status === 'offline' && connectivityLost)
    if (probe && !probing && canProbe) {
      probing = true
      const seq = failureSeq
      probe(signal)
        .then(
          (ok) => {
            if (ok && !signal.aborted && seq === failureSeq && status !== 'unavailable') {
              setStatus('online')
            }
          },
          () => {
            // The long poll reports real failures; a failed probe just changes nothing.
          },
        )
        .finally(() => {
          probing = false
        })
    }
    try {
      const notification = await client.receiveNotification(receiveTimeoutSec, signal)
      failures = 0
      connectivityLost = false
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
      failureSeq += 1
      connectivityLost =
        error instanceof GreenApiError && (error.kind === 'network' || error.kind === 'timeout')
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
