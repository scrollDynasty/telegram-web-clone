import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useChatStore } from '@/entities/chat/context'
import { chatTitle } from '@/entities/chat/model'
import { useMarkChatRead } from '@/features/mark-read/useMarkChatRead'
import { useSendMessage } from '@/features/send-message/useSendMessage'
import { isCoarsePointer } from '@/shared/lib/focus'
import { formatPhone } from '@/shared/lib/phone'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Dialog, DialogActions } from '@/shared/ui/Dialog'
import { IconButton } from '@/shared/ui/IconButton'
import styles from './ChatView.module.css'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

/**
 * The header and composer float over the message list (Telegram Web A layout), so the list
 * needs the composer's live height to reserve room at the bottom: it is exposed to the whole
 * chat view as --composer-height.
 */
function observeComposerHeight(slot: HTMLDivElement | null) {
  const view = slot?.parentElement
  if (!slot || !view || typeof ResizeObserver === 'undefined') return
  const observer = new ResizeObserver(() => {
    view.style.setProperty('--composer-height', `${slot.offsetHeight}px`)
  })
  observer.observe(slot)
  return () => observer.disconnect()
}

export function ChatView({ chatId }: { chatId: string }) {
  const chat = useChatStore((s) => s.chats[chatId])
  const closeChat = useChatStore((s) => s.closeChat)
  const deleteChat = useChatStore((s) => s.deleteChat)
  const { send, retry } = useSendMessage(chatId)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const lastIncomingId = useChatStore(
    (s) => s.chats[chatId]?.messages.findLast((m) => m.direction === 'in')?.id,
  )
  useMarkChatRead(chatId, lastIncomingId)

  if (!chat) return null

  const title = chatTitle(chat)
  const subtitle = [chat.phone && formatPhone(chat.phone), chat.username]
    .filter(Boolean)
    .filter((s) => s !== title)
    .join(' · ')

  return (
    <section className={styles.view} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        <IconButton label="Назад к чатам" className={styles.back} onClick={closeChat}>
          <ArrowLeft size={24} />
        </IconButton>
        <Avatar seed={chat.id} name={title} size={40} fontSize={17} className={styles.avatar} />
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.subtitle}>{subtitle || 'Telegram'}</span>
        </div>
        <IconButton
          label="Удалить чат"
          className={styles.action}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 size={22} />
        </IconButton>
      </header>

      <MessageList key={chat.id} messages={chat.messages} peerName={title} onRetry={retry} />

      <div ref={observeComposerHeight} className={styles.composer}>
        <Composer key={`composer-${chat.id}`} onSend={send} autoFocus={!isCoarsePointer()} />
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Удалить чат?"
        description="История будет удалена только в этом браузере. В Telegram переписка сохранится."
      >
        <DialogActions>
          <Button variant="danger" onClick={() => deleteChat(chat.id)}>
            Удалить
          </Button>
          {/* The safe action takes the initial focus, not the destructive one. */}
          <Button variant="text" data-autofocus onClick={() => setConfirmOpen(false)}>
            Отмена
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
