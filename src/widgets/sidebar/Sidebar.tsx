import clsx from 'clsx'
import { CircleAlert, LogOut, Search, SquarePen, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useChatStore } from '@/entities/chat/context'
import { chatTitle } from '@/entities/chat/model'
import { useSessionStore } from '@/entities/session/store'
import { NewChatDialog } from '@/features/new-chat/NewChatDialog'
import type { ConnectionStatus } from '@/features/polling/pollingLoop'
import type { ConnectionState } from '@/features/polling/useNotificationPolling'
import { ThemeMenuItems } from '@/features/theme/ThemeMenuItems'
import { formatPhone } from '@/shared/lib/phone'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu'
import { Spinner } from '@/shared/ui/Spinner'
import { ChatListItem } from './ChatListItem'
import styles from './Sidebar.module.css'
import { useChatListFlip } from './useChatListFlip'

const STATUS_TEXT: Record<Exclude<ConnectionStatus, 'online'>, string> = {
  connecting: 'Подключение…',
  offline: 'Ожидание сети…',
  unavailable: 'Инстанс GREEN-API недоступен',
}

export function Sidebar({ connection }: { connection: ConnectionState }) {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const openChat = useChatStore((s) => s.openChat)
  const account = useSessionStore((s) => s.account)
  const idInstance = useSessionStore((s) => s.credentials?.idInstance ?? '')
  const logout = useSessionStore((s) => s.logout)

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Like Telegram, the yellow status banner can be collapsed into a spinner in the search field.
  const [statusMinimized, setStatusMinimized] = useState(false)

  const sortedChats = useMemo(
    () => Object.values(chats).sort((a, b) => b.lastActivityAt - a.lastActivityAt),
    [chats],
  )

  const visibleChats = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return sortedChats
    const digits = q.replace(/\D/g, '')
    return sortedChats.filter(
      (chat) =>
        chatTitle(chat).toLowerCase().includes(q) ||
        chat.username?.toLowerCase().includes(q) ||
        (digits.length > 0 && chat.phone?.includes(digits)),
    )
  }, [sortedChats, deferredQuery])

  const listRef = useRef<HTMLUListElement>(null)
  useChatListFlip(listRef, deferredQuery)

  const accountName =
    account?.username ?? (account?.phone ? formatPhone(account.phone) : 'Мой аккаунт')
  const statusText =
    connection.status === 'online' ? null : (connection.message ?? STATUS_TEXT[connection.status])
  // Not a connectivity problem: the instance needs the user's attention, nothing is loading.
  const statusIsAlert = connection.status === 'unavailable'
  const showStatusBanner = statusText !== null && !statusMinimized
  const searchInputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className={styles.sidebar} aria-label="Чаты">
      {/* One persistent live region, so status changes are announced whatever is on screen. */}
      <span className="visually-hidden" aria-live="polite">
        {statusText ?? ''}
      </span>

      <header className={styles.header}>
        {/* The banner covers the menu and the search: keep them out of reach until collapsed. */}
        <div className={styles.headerControls} inert={showStatusBanner}>
          <Menu label="Меню" icon={<span className={styles.menuIcon} aria-hidden="true" />}>
            <MenuItem
              icon={<Avatar seed={idInstance} name={accountName} src={account?.avatar} size={32} />}
              description={`инстанс ${idInstance}`}
              title="Скопировать ID инстанса"
              onSelect={() => void navigator.clipboard?.writeText(idInstance).catch(() => {})}
            >
              {accountName}
            </MenuItem>
            <MenuSeparator />
            <ThemeMenuItems />
            <MenuSeparator />
            <MenuItem icon={<LogOut size={20} />} danger onSelect={() => logout()}>
              Выйти
            </MenuItem>
          </Menu>

          {/* A <div>, not a <label>: a label would name the status button instead of the input. */}
          <div
            className={styles.search}
            onPointerDown={(event) => {
              // A press on the field's padding focuses the input, as a label would.
              if (event.target === event.currentTarget) {
                event.preventDefault()
                searchInputRef.current?.focus()
              }
            }}
          >
            {statusText !== null && statusMinimized ? (
              <button
                type="button"
                className={clsx(styles.searchSpinner, statusIsAlert && styles.searchAlert)}
                onClick={() => setStatusMinimized(false)}
                aria-label={`${statusText} Показать статус`}
                title={statusText}
              >
                {statusIsAlert ? (
                  <CircleAlert size={22} aria-hidden="true" />
                ) : (
                  <Spinner size={20} />
                )}
              </button>
            ) : (
              <Search size={24} className={styles.searchIcon} aria-hidden="true" />
            )}
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Поиск"
              aria-label="Поиск по чатам"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {showStatusBanner && (
          <button
            type="button"
            className={clsx(styles.status, statusIsAlert && styles.statusAlert)}
            onClick={() => setStatusMinimized(true)}
            aria-label={`Свернуть статус: ${statusText}`}
            title={statusIsAlert ? statusText : 'Свернуть'}
          >
            {statusIsAlert ? (
              <CircleAlert size={28} className={styles.statusIcon} aria-hidden="true" />
            ) : (
              <Spinner size={28} />
            )}
            <span className={styles.statusText}>{statusText}</span>
            <X size={20} className={styles.statusClose} aria-hidden="true" />
          </button>
        )}
      </header>

      <nav className={styles.list} aria-label="Список чатов">
        {sortedChats.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptySticker} aria-hidden="true">
              💬
            </span>
            <p className={styles.emptyTitle}>Здесь пока нет чатов</p>
            <p className={styles.emptyText}>
              Введите номер телефона собеседника, чтобы начать переписку
            </p>
            <Button pill className={styles.emptyButton} onClick={() => setDialogOpen(true)}>
              <SquarePen size={24} aria-hidden="true" />
              Начать чат
            </Button>
          </div>
        ) : visibleChats.length === 0 ? (
          <p className={styles.noResults}>Ничего не найдено</p>
        ) : (
          <ul ref={listRef} className={styles.ul}>
            {visibleChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onSelect={openChat}
              />
            ))}
          </ul>
        )}
      </nav>

      <IconButton
        label="Новый чат"
        variant="accent"
        size="lg"
        className={styles.fab}
        onClick={() => setDialogOpen(true)}
      >
        <SquarePen size={24} />
      </IconButton>

      <NewChatDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </aside>
  )
}
