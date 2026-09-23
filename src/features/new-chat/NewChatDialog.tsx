import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useChatStoreApi } from '@/entities/chat/context'
import { useGreenApiClient } from '@/shared/api/client-context'
import { describeError, isAbortError } from '@/shared/api/errors'
import { focusOpenChat } from '@/shared/lib/focus'
import { parseRecipient } from '@/shared/lib/phone'
import { Button } from '@/shared/ui/Button'
import { Dialog, DialogActions } from '@/shared/ui/Dialog'
import { TextField } from '@/shared/ui/TextField'
import styles from './NewChatDialog.module.css'

interface NewChatDialogProps {
  open: boolean
  onClose: () => void
}

export function NewChatDialog({ open, onClose }: NewChatDialogProps) {
  // Set when the dialog opened a chat: focus then goes to that chat, not back to the opener.
  const openedChat = useRef(false)
  const handleOpened = useCallback(() => {
    openedChat.current = true
    onClose()
  }, [onClose])
  const handleClosed = useCallback(() => {
    if (openedChat.current) focusOpenChat()
    openedChat.current = false
  }, [])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onClosed={handleClosed}
      title="Новый чат"
      wide
      description="Номер телефона получателя в международном формате или его @username в Telegram"
    >
      <NewChatForm open={open} onOpened={handleOpened} onCancel={onClose} />
    </Dialog>
  )
}

interface NewChatFormProps {
  /** False while the dialog plays its exit animation: a pending check must not open a chat. */
  open: boolean
  onOpened: () => void
  onCancel: () => void
}

/** Separate component so its state resets every time the dialog opens. */
function NewChatForm({ open, onOpened, onCancel }: NewChatFormProps) {
  const client = useGreenApiClient()
  const store = useChatStoreApi()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)

  // Cancel (button, Esc, backdrop) or unmount aborts the CheckAccount request in flight.
  useEffect(() => {
    if (!open) request.current?.abort()
  }, [open])
  useEffect(() => () => request.current?.abort(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const recipient = parseRecipient(value)
    if (!recipient.ok) {
      setError(recipient.error)
      return
    }

    const { chats, openChat, upsertChat } = store.getState()
    const existing = Object.values(chats).find((chat) =>
      recipient.kind === 'phone'
        ? chat.phone === recipient.phone
        : chat.username?.toLowerCase() === recipient.username.toLowerCase(),
    )
    if (existing) {
      openChat(existing.id)
      onOpened()
      return
    }

    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(undefined)
    try {
      // Telegram needs a numeric chatId: resolve it up front instead of failing on first send.
      const result = await client.checkAccount(
        recipient.kind === 'phone'
          ? { phoneNumber: recipient.phone }
          : { username: recipient.username },
        controller.signal,
      )
      if (controller.signal.aborted) return
      if (!result.exist) {
        setError(
          recipient.kind === 'phone'
            ? 'У этого номера нет Telegram или он скрыт настройками приватности'
            : 'Пользователь с таким юзернеймом не найден',
        )
        return
      }
      upsertChat({
        id: result.chatId,
        phone: recipient.kind === 'phone' ? recipient.phone : undefined,
        username:
          result.username ?? (recipient.kind === 'username' ? recipient.username : undefined),
      })
      openChat(result.chatId)
      onOpened()
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return
      setError(describeError(err))
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending(false)
      }
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Телефон или @username"
        name="recipient"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(undefined)
        }}
        error={error}
        hint="Например, +7 987 654-32-10"
        autoFocus
      />
      <DialogActions>
        <Button variant="text" type="submit" loading={pending} disabled={!value.trim()}>
          Создать чат
        </Button>
        <Button variant="text" onClick={onCancel}>
          Отмена
        </Button>
      </DialogActions>
    </form>
  )
}
