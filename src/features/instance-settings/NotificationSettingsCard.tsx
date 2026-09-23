import { BellOff, CircleCheck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import styles from './NotificationSettingsCard.module.css'
import { useNotificationSettings, type NotificationSettingsState } from './useNotificationSettings'

function reasonText(state: NotificationSettingsState): string {
  if (state.status === 'error') return state.message
  if (state.status === 'needs-setup' && state.webhookUrlSet) {
    return 'В инстансе указан webhook URL: пока он задан, уведомления уходят туда, а не в этот чат.'
  }
  if (state.status === 'needs-setup' && state.incomingOff) {
    return 'В настройках инстанса выключены уведомления о входящих сообщениях: ответы не будут появляться в чате.'
  }
  return 'В настройках инстанса выключены уведомления о статусах и отправленных сообщениях.'
}

/** Shown above the chat list when the instance is not set up to deliver notifications. */
export function NotificationSettingsCard() {
  const { state, enable, dismiss } = useNotificationSettings()
  const titleRef = useRef<HTMLParagraphElement>(null)
  const applied = state.status === 'applied'

  // The button the user pressed is gone once applied: keep keyboard focus inside the card.
  useEffect(() => {
    if (applied) titleRef.current?.focus()
  }, [applied])

  if (state.status === 'checking' || state.status === 'ok') return null

  function handleDismiss() {
    dismiss()
    // The card (and the focused close button) disappears: continue from the chat search.
    document.querySelector<HTMLElement>('input[type="search"]')?.focus()
  }

  return (
    // One section for every state, so its live region is already mounted when the text changes.
    <section className={styles.card} aria-labelledby="notif-setup-title">
      {applied ? (
        <CircleCheck size={24} className={styles.iconOk} aria-hidden="true" />
      ) : (
        <BellOff size={24} className={styles.icon} aria-hidden="true" />
      )}
      <div className={styles.body}>
        <p id="notif-setup-title" ref={titleRef} tabIndex={-1} className={styles.title}>
          {applied ? 'Уведомления включены' : 'Получение сообщений не настроено'}
        </p>
        <p className={styles.text} aria-live="polite">
          {applied
            ? 'GREEN-API перезапустит инстанс и применит настройки в течение нескольких минут. После этого новые сообщения начнут приходить в чат.'
            : reasonText(state)}
        </p>
        {!applied && (
          <Button
            pill
            className={styles.action}
            loading={state.status === 'applying'}
            onClick={enable}
          >
            {state.status === 'error' ? 'Повторить' : 'Включить'}
          </Button>
        )}
      </div>
      {applied && (
        <IconButton label="Скрыть" className={styles.close} onClick={handleDismiss}>
          <X size={20} />
        </IconButton>
      )}
    </section>
  )
}
