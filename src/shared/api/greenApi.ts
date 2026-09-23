import type { z } from 'zod'
import { GreenApiError, isAbortError, kindFromStatus, localizeApiMessage } from './errors'
import {
  accountSettingsSchema,
  checkAccountResponseSchema,
  deleteNotificationResponseSchema,
  instanceSettingsSchema,
  receiveNotificationResponseSchema,
  sendMessageResponseSchema,
  setSettingsResponseSchema,
  type AccountSettings,
  type InstanceSettings,
  type ReceivedNotification,
} from './schemas'

export interface GreenApiCredentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type CheckAccountResult =
  { exist: true; chatId: string; username?: string } | { exist: false }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  /** Extra path segment appended after the token (e.g. receiptId). */
  pathSuffix?: string
  query?: Record<string, string | number>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * GREEN-API serves each instance from a host named after the first 4 digits of its id
 * (e.g. Telegram instance 4100123456 → https://4100.api.green-api.com). Unlike the shared
 * api.green-api.com, these hosts allow browser DELETE requests (deleteNotification) via CORS.
 */
export function apiUrlForInstance(idInstance: string): string | null {
  const digits = idInstance.trim()
  return /^\d{4,}$/.test(digits) ? `https://${digits.slice(0, 4)}.api.green-api.com` : null
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '')
}

const SHARED_API_HOST = 'api.green-api.com'

/**
 * The host the browser must actually talk to. The shared api.green-api.com accepts reads and
 * sendMessage, but its CORS policy has no DELETE: deleteNotification fails and the notification
 * queue gets stuck on its first item (nothing is ever received). Sessions saved with that host
 * (the old default) are transparently redirected to the instance host.
 */
export function resolveApiUrl(apiUrl: string, idInstance: string): string {
  const normalized = normalizeApiUrl(apiUrl)
  let host = ''
  try {
    host = new URL(normalized).hostname
  } catch {
    // Invalid or empty: fall through to the instance host.
  }
  if (!normalized || host === SHARED_API_HOST) return apiUrlForInstance(idInstance) ?? normalized
  return normalized
}

/**
 * Thin typed client over the GREEN-API HTTP API (Telegram instance).
 * Every response is validated with zod, every failure becomes a GreenApiError
 * (AbortError from a caller-provided signal is re-thrown untouched).
 */
export class GreenApiClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchImpl: typeof fetch

  constructor(credentials: GreenApiCredentials, fetchImpl: typeof fetch = fetch) {
    const apiUrl = resolveApiUrl(credentials.apiUrl, credentials.idInstance)
    this.baseUrl = `${apiUrl}/waInstance${credentials.idInstance.trim()}`
    this.token = credentials.apiTokenInstance.trim()
    // Bind so `this` is not the client when calling the global fetch.
    this.fetchImpl = fetchImpl.bind(globalThis)
  }

  getAccountSettings(signal?: AbortSignal): Promise<AccountSettings> {
    return this.request('getAccountSettings', accountSettingsSchema, { signal })
  }

  /** Resolves a phone number or @username to a Telegram chatId (recommended way to address chats). */
  async checkAccount(
    target: { phoneNumber: string } | { username: string },
    signal?: AbortSignal,
  ): Promise<CheckAccountResult> {
    const body =
      'phoneNumber' in target
        ? { phoneNumber: Number(target.phoneNumber) }
        : { username: target.username }
    const data = await this.request('checkAccount', checkAccountResponseSchema, {
      method: 'POST',
      body,
      signal,
    })
    if (typeof data.exist === 'boolean') {
      return data.exist && data.chatId
        ? { exist: true, chatId: data.chatId, username: data.username || undefined }
        : { exist: false }
    }
    const reason = data.data?.reason ?? data.reason ?? 'Не удалось проверить номер'
    const kind = reason.includes('rate_limit') ? 'rate_limit' : 'bad_request'
    throw new GreenApiError(kind, reason)
  }

  async sendMessage(chatId: string, message: string, signal?: AbortSignal) {
    const { idMessage } = await this.request('sendMessage', sendMessageResponseSchema, {
      method: 'POST',
      body: { chatId, message },
      signal,
    })
    return idMessage
  }

  /** Long-polls the notification queue. Resolves with `null` when the queue stayed empty. */
  async receiveNotification(
    receiveTimeoutSec: number,
    signal?: AbortSignal,
  ): Promise<ReceivedNotification | null> {
    try {
      return await this.request('receiveNotification', receiveNotificationResponseSchema, {
        query: { receiveTimeout: receiveTimeoutSec },
        signal,
        timeoutMs: (receiveTimeoutSec + 10) * 1000,
      })
    } catch (error) {
      // Telegram instances answer an empty long poll with 408 Request Timeout instead of `null`.
      if (error instanceof GreenApiError && error.status === 408) return null
      throw error
    }
  }

  getSettings(signal?: AbortSignal): Promise<InstanceSettings> {
    return this.request('getSettings', instanceSettingsSchema, { signal })
  }

  /** Changes instance settings. GREEN-API restarts the instance and applies them within ~5 min. */
  async setSettings(
    settings: Partial<Record<keyof InstanceSettings, string>>,
    signal?: AbortSignal,
  ) {
    const { saveSettings } = await this.request('setSettings', setSettingsResponseSchema, {
      method: 'POST',
      body: settings,
      signal,
    })
    return saveSettings
  }

  async deleteNotification(receiptId: number, signal?: AbortSignal): Promise<boolean> {
    const { result } = await this.request('deleteNotification', deleteNotificationResponseSchema, {
      method: 'DELETE',
      pathSuffix: String(receiptId),
      signal,
    })
    return result
  }

  private async request<S extends z.ZodType>(
    apiMethod: string,
    schema: S,
    {
      method = 'GET',
      pathSuffix,
      query,
      body,
      signal,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    }: RequestOptions,
  ): Promise<z.infer<S>> {
    let url = `${this.baseUrl}/${apiMethod}/${this.token}`
    if (pathSuffix) url += `/${pathSuffix}`
    if (query) {
      url += `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

    // Reading the body can fail too (timeout or connection drop mid-stream): same mapping.
    const fail = (error: unknown): never => {
      if (signal?.aborted) throw signal.reason ?? error
      if (timeoutSignal.aborted) {
        throw new GreenApiError('timeout', `${apiMethod}: timeout`, undefined, { cause: error })
      }
      if (isAbortError(error)) throw error
      throw new GreenApiError('network', `${apiMethod}: network error`, undefined, {
        cause: error,
      })
    }

    let response: Response
    let text: string
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combinedSignal,
      })
      text = await response.text()
    } catch (error) {
      return fail(error)
    }

    if (!response.ok) {
      throw new GreenApiError(
        kindFromStatus(response.status),
        extractErrorMessage(text) ?? `${apiMethod}: HTTP ${response.status}`,
        response.status,
      )
    }

    let json: unknown = null
    if (text.trim()) {
      try {
        json = JSON.parse(text)
      } catch (error) {
        throw new GreenApiError('invalid_response', `${apiMethod}: invalid JSON`, response.status, {
          cause: error,
        })
      }
    }

    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      throw new GreenApiError(
        'invalid_response',
        `${apiMethod}: unexpected response`,
        response.status,
        {
          cause: parsed.error,
        },
      )
    }
    return parsed.data
  }
}

/** GREEN-API error bodies: `{ message }`, `{ error, details }` (400) or plain text. */
function extractErrorMessage(text: string): string | undefined {
  const raw = text.trim()
  if (!raw) return undefined
  let message: string | undefined = raw
  try {
    const data: unknown = JSON.parse(raw)
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      const field = [record.message, record.details, record.error].find(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      )
      message = field?.trim()
    }
  } catch {
    // Not JSON: the raw text is the message.
  }
  if (!message) return undefined
  return localizeApiMessage(message) ?? (message.length <= 200 ? message : undefined)
}
