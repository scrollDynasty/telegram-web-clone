import { useCallback, useEffect, useState } from 'react'
import { useGreenApiClient } from '@/shared/api/client-context'
import { describeError, isAbortError } from '@/shared/api/errors'
import type { InstanceSettings } from '@/shared/api/schemas'

/**
 * What the chat needs from the instance to receive anything over the HTTP API: an empty webhook
 * URL, plus incoming messages, statuses and our own messages (from the phone and via the API).
 * GREEN-API creates instances with all notifications switched off.
 */
export const REQUIRED_SETTINGS = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
} as const satisfies Partial<Record<keyof InstanceSettings, string>>

export type NotificationSettingsState =
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'needs-setup'; webhookUrlSet: boolean; incomingOff: boolean }
  | { status: 'applying' }
  | { status: 'applied' }
  | { status: 'error'; message: string }

export function evaluateSettings(settings: InstanceSettings): NotificationSettingsState {
  const webhookUrlSet = Boolean(settings.webhookUrl?.trim())
  const missing = (Object.keys(REQUIRED_SETTINGS) as (keyof typeof REQUIRED_SETTINGS)[]).some(
    (key) => key !== 'webhookUrl' && settings[key] !== REQUIRED_SETTINGS[key],
  )
  if (!webhookUrlSet && !missing) return { status: 'ok' }
  return { status: 'needs-setup', webhookUrlSet, incomingOff: settings.incomingWebhook !== 'yes' }
}

/**
 * Checks once per session that the instance actually delivers notifications, and lets the user
 * switch them on. Settings are never changed silently: SetSettings restarts the instance.
 */
export function useNotificationSettings() {
  const client = useGreenApiClient()
  const [state, setState] = useState<NotificationSettingsState>({ status: 'checking' })

  useEffect(() => {
    const controller = new AbortController()
    client
      .getSettings(controller.signal)
      .then((settings) => setState(evaluateSettings(settings)))
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        // Not being able to check is not a reason to nag: polling reports real outages.
        setState({ status: 'ok' })
      })
    return () => controller.abort()
  }, [client])

  const enable = useCallback(async () => {
    setState({ status: 'applying' })
    try {
      const saved = await client.setSettings(REQUIRED_SETTINGS)
      setState(
        saved
          ? { status: 'applied' }
          : { status: 'error', message: 'GREEN-API не сохранил настройки' },
      )
    } catch (error) {
      setState({ status: 'error', message: describeError(error) })
    }
  }, [client])

  const dismiss = useCallback(() => setState({ status: 'ok' }), [])

  return { state, enable, dismiss }
}
