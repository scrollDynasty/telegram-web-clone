import { BellOff, CircleCheck, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import styles from './NotificationSettingsCard.module.css'
import { useNotificationSettings } from './useNotificationSettings'

/** Shown above the chat list when the instance is not set up to deliver notifications. */
export function NotificationSettingsCard() {
  const { state, enable, dismiss } = useNotificationSettings()

  if (state.status === 'checking' || state.status === 'ok') return null

  if (state.status === 'applied') {
    return (
      <section className={styles.card} role="status">
        <CircleCheck size={24} className={styles.iconOk} aria-hidden="true" />
        <div className={styles.body}>
          <p className={styles.title}>Уведомления включены</p>
          <p className={styles.text}>
            GREEN-API перезапустит инстанс и применит настройки в течение нескольких минут. После
            этого новые сообщения начнут приходить в чат.
          </p>
        </div>
        <IconButton label="Скрыть" className={styles.close} onClick={dismiss}>
          <X size={20} />
        </IconButton>
      </section>
    )
  }

  const reason =
    state.status === 'needs-setup' && state.webhookUrlSet
      ? 'В инстансе указан webhook URL: пока он задан, уведомления уходят туда, а не в этот чат.'
      : state.status === 'needs-setup' && state.incomingOff
        ? 'В настройках инстанса выключены уведомления о входящих сообщениях: ответы не будут появляться в чате.'
        : 'В настройках инстанса выключены уведомления о статусах и отправленных сообщениях.'

  return (
    <section className={styles.card} aria-labelledby="notif-setup-title">
      <BellOff size={24} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <p id="notif-setup-title" className={styles.title}>
          Получение сообщений не настроено
        </p>
        <p className={styles.text}>{state.status === 'error' ? state.message : reason}</p>
        <Button
          pill
          className={styles.action}
          loading={state.status === 'applying'}
          onClick={enable}
        >
          {state.status === 'error' ? 'Повторить' : 'Включить'}
        </Button>
      </div>
    </section>
  )
}
